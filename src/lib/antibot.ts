import { getDb } from "./db";
import { ANTIBOT } from "./constants";

export interface AntiBotCheckResult {
  passed: boolean;
  reason?:
    | "account_too_new"
    | "insufficient_followers"
    | "already_claimed"
    | "rate_limited"
    | "missing_profile_data";
}

export function checkAccountAge(createdAt: string): boolean {
  if (!createdAt) return false; // Fail closed — reject if data unavailable
  const accountDate = new Date(createdAt);
  if (isNaN(accountDate.getTime())) return false; // Fail closed — reject if unparseable
  const now = new Date();
  const diffDays = (now.getTime() - accountDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= ANTIBOT.MIN_ACCOUNT_AGE_DAYS;
}

export function checkFollowerCount(followers: number): boolean {
  if (typeof followers !== "number" || isNaN(followers)) return false; // Fail closed
  return followers >= ANTIBOT.MIN_FOLLOWERS;
}

export async function checkDuplicate(
  packetId: number,
  twitterUserId: string
): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    SELECT id FROM claims
    WHERE packet_id = ${packetId} AND claimer_twitter_id = ${twitterUserId}
    LIMIT 1
  `;
  return result.length === 0;
}

export async function checkRateLimit(twitterUserId: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    SELECT COUNT(*) as count FROM rate_limits
    WHERE twitter_user_id = ${twitterUserId}
    AND claimed_at > NOW() - INTERVAL '24 hours'
  `;
  return Number(result[0].count) < ANTIBOT.MAX_CLAIMS_PER_DAY;
}

export async function runAntiBotChecks(
  packetId: number,
  twitterUserId: string,
  twitterCreatedAt: string,
  followersCount: number
): Promise<AntiBotCheckResult> {
  // Require profile data to be present — fail closed
  if (!twitterCreatedAt && (typeof followersCount !== "number" || followersCount === 0)) {
    return { passed: false, reason: "missing_profile_data" };
  }

  if (!checkAccountAge(twitterCreatedAt)) {
    return { passed: false, reason: "account_too_new" };
  }

  if (!checkFollowerCount(followersCount)) {
    return { passed: false, reason: "insufficient_followers" };
  }

  const notDuplicate = await checkDuplicate(packetId, twitterUserId);
  if (!notDuplicate) {
    return { passed: false, reason: "already_claimed" };
  }

  const withinRateLimit = await checkRateLimit(twitterUserId);
  if (!withinRateLimit) {
    return { passed: false, reason: "rate_limited" };
  }

  return { passed: true };
}
