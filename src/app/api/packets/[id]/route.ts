import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { baseSepolia, base } from "viem/chains";
import { getDb } from "@/lib/db";
import { RED_PACKET_CONTRACT, RED_PACKET_ABI, CHAIN_ID, BASE_CHAIN_ID } from "@/lib/constants";
import { formatUSDC } from "@/lib/utils";

const chain = CHAIN_ID === BASE_CHAIN_ID ? base : baseSepolia;

const publicClient = createPublicClient({
  chain,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Look up the onchain packet_id from the UUID
  const sql = getDb();
  const rows = await sql`
    SELECT packet_id, creator_twitter_handle, creator_twitter_avatar
    FROM packets WHERE id = ${id} LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Packet not found" }, { status: 404 });
  }

  const packetId = rows[0].packet_id;

  try {
    const onchainData = (await publicClient.readContract({
      address: RED_PACKET_CONTRACT,
      abi: RED_PACKET_ABI,
      functionName: "packets",
      args: [BigInt(packetId)],
    })) as [string, bigint, bigint, number, number, number, boolean, boolean];

    const [creator, totalAmount, , totalClaims, claimedCount, expiry, isRandom, refunded] =
      onchainData;

    if (creator === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "Packet not found" }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);

    return NextResponse.json({
      packetId,
      creator: {
        twitterHandle: rows[0].creator_twitter_handle || "",
        twitterAvatar: rows[0].creator_twitter_avatar || null,
      },
      totalAmount: formatUSDC(totalAmount),
      totalClaims,
      claimedCount,
      isRandom,
      expiry: Number(expiry),
      isExpired: now >= Number(expiry),
      isFullyClaimed: claimedCount >= totalClaims,
      refunded,
    });
  } catch (error) {
    console.error("Error fetching packet:", error);
    return NextResponse.json({ error: "Failed to fetch packet" }, { status: 500 });
  }
}
