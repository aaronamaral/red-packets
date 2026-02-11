import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { createPublicClient, http, decodeEventLog, formatUnits } from "viem";
import { baseSepolia, base } from "viem/chains";
import { RED_PACKET_CONTRACT, RED_PACKET_ABI, CHAIN_ID, BASE_CHAIN_ID, USDC_DECIMALS } from "@/lib/constants";

const chain = CHAIN_ID === BASE_CHAIN_ID ? base : baseSepolia;

const publicClient = createPublicClient({
  chain,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
});

// Verify a claim transaction on-chain and record the actual amount
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.twitterId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Resolve UUID to onchain packet_id
  const sql = getDb();
  const packetRows = await sql`
    SELECT packet_id FROM packets WHERE id = ${id} LIMIT 1
  `;
  if (packetRows.length === 0) {
    return NextResponse.json({ error: "Packet not found" }, { status: 404 });
  }
  const packetId = packetRows[0].packet_id as number;

  const body = await req.json();
  const { txHash } = body;

  if (!txHash || typeof txHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
  }

  // Verify the transaction on-chain
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Verify the transaction was sent to our contract
  if (receipt.to?.toLowerCase() !== RED_PACKET_CONTRACT.toLowerCase()) {
    return NextResponse.json({ error: "Transaction is not for this contract" }, { status: 400 });
  }

  // Verify the transaction succeeded
  if (receipt.status !== "success") {
    return NextResponse.json({ error: "Transaction failed" }, { status: 400 });
  }

  // Parse PacketClaimed event from logs
  let claimedAmount: string | null = null;
  let claimer: string | null = null;

  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: RED_PACKET_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === "PacketClaimed") {
        const args = event.args as { packetId: bigint; claimer: string; amount: bigint };
        if (Number(args.packetId) === packetId) {
          claimedAmount = formatUnits(args.amount, USDC_DECIMALS);
          claimer = args.claimer;
          break;
        }
      }
    } catch {
      // Not our event
    }
  }

  if (!claimedAmount || !claimer) {
    return NextResponse.json({ error: "No matching claim event found" }, { status: 400 });
  }

  // Update the claim record — only if it belongs to the authenticated user
  const result = await sql`
    UPDATE claims
    SET amount = ${claimedAmount}, tx_hash = ${txHash}
    WHERE packet_id = ${packetId}
      AND claimer_twitter_id = ${session.user.twitterId}
      AND claimer_address = ${claimer.toLowerCase()}
    RETURNING id
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: "Claim record not found" }, { status: 404 });
  }

  return NextResponse.json({ amount: claimedAmount });
}
