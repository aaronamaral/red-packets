import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runAntiBotChecks } from "@/lib/antibot";
import { signClaim } from "@/lib/eip712";
import { getDb } from "@/lib/db";
import { createPublicClient, http } from "viem";
import { baseSepolia, base } from "viem/chains";
import { RED_PACKET_CONTRACT, RED_PACKET_ABI, CHAIN_ID, BASE_CHAIN_ID } from "@/lib/constants";

const chain = CHAIN_ID === BASE_CHAIN_ID ? base : baseSepolia;

const publicClient = createPublicClient({
  chain,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
});

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
  const { claimerAddress } = body;

  if (!claimerAddress || typeof claimerAddress !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(claimerAddress)) {
    return NextResponse.json({ error: "Invalid claimer address" }, { status: 400 });
  }

  // Check onchain state
  try {
    const onchainData = (await publicClient.readContract({
      address: RED_PACKET_CONTRACT,
      abi: RED_PACKET_ABI,
      functionName: "packets",
      args: [BigInt(packetId)],
    })) as [string, bigint, bigint, number, number, number, boolean, boolean];

    const [creator, , , totalClaims, claimedCount, expiry, , refunded] = onchainData;

    if (creator === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "Packet not found" }, { status: 404 });
    }

    if (refunded) {
      return NextResponse.json(
        { error: "Packet refunded", reason: "packet_refunded" },
        { status: 410 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= Number(expiry)) {
      return NextResponse.json(
        { error: "Packet expired", reason: "packet_expired" },
        { status: 410 }
      );
    }

    if (claimedCount >= totalClaims) {
      return NextResponse.json(
        { error: "Packet fully claimed", reason: "packet_full" },
        { status: 410 }
      );
    }
  } catch (error) {
    console.error("Error checking onchain state:", error);
    return NextResponse.json({ error: "Failed to verify packet" }, { status: 500 });
  }

  // Run anti-bot checks
  const antiBotResult = await runAntiBotChecks(
    packetId,
    session.user.twitterId,
    session.user.createdAt,
    session.user.followersCount
  );

  if (!antiBotResult.passed) {
    return NextResponse.json(
      { error: "Anti-bot check failed", reason: antiBotResult.reason },
      { status: 403 }
    );
  }

  // Generate nonce
  const nonce = BigInt(
    "0x" +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
  );

  // ATOMIC: Insert claim BEFORE signing — prevents race condition.
  // If a concurrent request already inserted for this (packet_id, twitter_user_id),
  // the INSERT returns no rows and we reject.
  const inserted = await sql`
    INSERT INTO claims (packet_id, claimer_address, claimer_twitter_id, claimer_twitter_handle, nonce, signature)
    VALUES (${packetId}, ${claimerAddress.toLowerCase()}, ${session.user.twitterId}, ${session.user.twitterHandle || ""}, ${nonce.toString()}, 'pending')
    ON CONFLICT (packet_id, claimer_twitter_id) DO NOTHING
    RETURNING id
  `;

  if (inserted.length === 0) {
    return NextResponse.json(
      { error: "Already claimed", reason: "already_claimed" },
      { status: 403 }
    );
  }

  // Record rate limit BEFORE signing
  await sql`
    INSERT INTO rate_limits (twitter_user_id)
    VALUES (${session.user.twitterId})
  `;

  // Now sign — we've locked the slot in the DB
  const signature = await signClaim(
    packetId,
    claimerAddress as `0x${string}`,
    session.user.twitterId,
    nonce
  );

  // Update the claim row with the actual signature
  await sql`
    UPDATE claims SET signature = ${signature}
    WHERE id = ${inserted[0].id}
  `;

  return NextResponse.json({
    signature,
    nonce: nonce.toString(),
    twitterUserId: session.user.twitterId,
  });
}

