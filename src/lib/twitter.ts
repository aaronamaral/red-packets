import { getDb } from "./db";

const FOLLOW_CACHE_TTL_MINUTES = 15;
const FOLLOW_PAGINATION_LIMIT = 20;

const userIdCache = new Map<string, string>();

interface FollowCacheRow {
  follows: boolean;
  checked_at: string;
}

interface FollowingPage {
  data?: Array<{ id: string }>;
  meta?: { next_token?: string };
}

async function fetchFollowingPage(
  accessToken: string,
  userId: string,
  paginationToken?: string
): Promise<FollowingPage> {
  const url = new URL(`https://api.twitter.com/2/users/${userId}/following`);
  url.searchParams.set("max_results", "1000");
  if (paginationToken) {
    url.searchParams.set("pagination_token", paginationToken);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`X API error: ${res.status}`);
  }

  return (await res.json()) as FollowingPage;
}

export async function resolveUserIdByUsername(
  accessToken: string,
  username: string
): Promise<string> {
  const normalized = username.replace(/^@/, "").toLowerCase();
  const cached = userIdCache.get(normalized);
  if (cached) return cached;

  const res = await fetch(`https://api.twitter.com/2/users/by/username/${normalized}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`X API error: ${res.status}`);
  }

  const data = (await res.json()) as { data?: { id?: string } };
  const userId = data.data?.id;
  if (!userId) {
    throw new Error("X API error: missing user id");
  }

  userIdCache.set(normalized, userId);
  return userId;
}

export async function checkUserFollowsCreator({
  accessToken,
  userId,
  creatorId,
  forceFresh = false,
}: {
  accessToken: string;
  userId: string;
  creatorId: string;
  forceFresh?: boolean;
}): Promise<{ follows: boolean; source: "cache" | "api" | "self" }> {
  if (userId === creatorId) {
    return { follows: true, source: "self" };
  }

  const sql = getDb();
  if (!forceFresh) {
    const cached = await sql<FollowCacheRow[]>`
      SELECT follows, checked_at FROM follow_cache
      WHERE user_id = ${userId} AND creator_id = ${creatorId}
      LIMIT 1
    `;

    if (cached.length > 0) {
      const checkedAt = new Date(cached[0].checked_at);
      if (!Number.isNaN(checkedAt.getTime())) {
        const ageMs = Date.now() - checkedAt.getTime();
        if (ageMs <= FOLLOW_CACHE_TTL_MINUTES * 60 * 1000) {
          return { follows: cached[0].follows, source: "cache" };
        }
      }
    }
  }

  let follows = false;
  let nextToken: string | undefined;

  for (let page = 0; page < FOLLOW_PAGINATION_LIMIT; page++) {
    const response = await fetchFollowingPage(accessToken, userId, nextToken);
    const ids = response.data?.map((user) => user.id) ?? [];

    if (ids.includes(creatorId)) {
      follows = true;
      break;
    }

    nextToken = response.meta?.next_token;
    if (!nextToken) {
      break;
    }
  }

  await sql`
    INSERT INTO follow_cache (user_id, creator_id, follows, checked_at)
    VALUES (${userId}, ${creatorId}, ${follows}, NOW())
    ON CONFLICT (user_id, creator_id)
    DO UPDATE SET follows = EXCLUDED.follows, checked_at = EXCLUDED.checked_at
  `;

  return { follows, source: "api" };
}
