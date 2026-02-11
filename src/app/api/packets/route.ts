import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.twitterId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();

  const created = await sql`
    SELECT id, packet_id, creator_address, creator_twitter_handle, tx_hash, created_at
    FROM packets
    WHERE creator_twitter_id = ${session.user.twitterId}
    ORDER BY created_at ASC
    LIMIT 50
  `;

  const claimed = await sql`
    SELECT c.packet_id, c.claimer_address, c.amount, c.claimed_at,
           p.creator_twitter_handle, p.creator_twitter_avatar
    FROM claims c
    LEFT JOIN packets p ON c.packet_id = p.packet_id
    WHERE c.claimer_twitter_id = ${session.user.twitterId}
    ORDER BY c.claimed_at DESC
    LIMIT 50
  `;

  return NextResponse.json({ created, claimed });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.twitterId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { packetId, creatorAddress, txHash } = body;

  if (packetId === undefined || !creatorAddress || !txHash) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sql = getDb();

  const inserted = await sql`
    INSERT INTO packets (packet_id, creator_address, creator_twitter_id, creator_twitter_handle, creator_twitter_avatar, tx_hash)
    VALUES (${packetId}, ${creatorAddress}, ${session.user.twitterId}, ${session.user.twitterHandle}, ${session.user.image || null}, ${txHash})
    ON CONFLICT (packet_id) DO NOTHING
    RETURNING id
  `;

  const uuid = inserted[0]?.id;

  return NextResponse.json({
    packetId,
    uuid,
  });
}
