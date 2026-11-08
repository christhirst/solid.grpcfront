import { RecordId } from "surrealdb";
import { logger } from "./logger";

export type VoteKind = "dashboard" | "workflow";
export type VoteValue = 1 | -1 | 0;

export interface VoteSummary {
  score: number;
  up: number;
  down: number;
  myVote: VoteValue;
  canVote: boolean;
}

export const EMPTY_VOTE_SUMMARY: VoteSummary = {
  score: 0,
  up: 0,
  down: 0,
  myVote: 0,
  canVote: false,
};

/**
 * Normalizes input vote value to 1 (up), -1 (down), or 0 (remove/none).
 * Returns null if the value is invalid.
 */
export function normalizeVoteValue(raw: unknown): VoteValue | null {
  if (raw === 1 || raw === "1" || raw === "up") return 1;
  if (raw === -1 || raw === "-1" || raw === "down") return -1;
  if (raw === 0 || raw === "0" || raw === "none" || raw === "clear" || raw === null) return 0;
  return null;
}

/**
 * Computes the next vote value when clicking an arrow:
 * - Clicking the same direction removes the vote (returns 0).
 * - Clicking the opposite direction switches to that direction.
 * - Clicking when no vote exists casts that direction.
 */
export function nextVoteValue(current: VoteValue, clicked: 1 | -1): VoteValue {
  return current === clicked ? 0 : clicked;
}

/**
 * Optimistically calculates the new VoteSummary when a user changes their vote.
 */
export function applyVoteChange(current: VoteSummary, next: VoteValue): VoteSummary {
  const prev = current.myVote;
  if (prev === next) return { ...current };

  let up = current.up;
  let down = current.down;

  if (prev === 1) up = Math.max(0, up - 1);
  else if (prev === -1) down = Math.max(0, down - 1);

  if (next === 1) up += 1;
  else if (next === -1) down += 1;

  return {
    ...current,
    score: up - down,
    up,
    down,
    myVote: next,
  };
}

/**
 * Extracts a clean string key for target dashboards or workflows,
 * stripping chevrons ⟨⟩ and table prefixes.
 */
export function voteKey(id: unknown): string {
  if (!id) return "";
  const str = String(id).trim().replace(/[⟨⟩]/g, "");
  return str.includes(":") ? str.split(":")[1] : str;
}

/**
 * Deterministic record ID for a vote: `vote:<kind>__<key>__<sub>`
 */
export function voteRecordId(kind: VoteKind, key: string, sub: string): RecordId {
  const cleanKey = voteKey(key);
  const cleanSub = String(sub || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "_");
  return new RecordId("vote", `${kind}__${cleanKey}__${cleanSub}`);
}

/**
 * Comparator function to sort items by votes descending (Top voted):
 * 1. Score descending
 * 2. Total upvotes descending
 * 3. Updated / created date descending
 */
export function compareByVotes(a: any, b: any): number {
  const aScore = a?.votes?.score ?? 0;
  const bScore = b?.votes?.score ?? 0;
  if (bScore !== aScore) return bScore - aScore;

  const aUp = a?.votes?.up ?? 0;
  const bUp = b?.votes?.up ?? 0;
  if (bUp !== aUp) return bUp - aUp;

  const aTime = new Date(a?.updated_at || a?.created_at || 0).getTime();
  const bTime = new Date(b?.updated_at || b?.created_at || 0).getTime();
  return bTime - aTime;
}

/**
 * Cast or remove a vote in SurrealDB.
 */
export async function castVote(
  db: any,
  kind: VoteKind,
  rawKey: string,
  sub: string,
  value: VoteValue
): Promise<VoteSummary> {
  const key = voteKey(rawKey);
  const recId = voteRecordId(kind, key, sub);
  const now = new Date().toISOString();

  if (value === 0) {
    try {
      await db.delete(recId);
    } catch (e: any) {
      // Fallback query delete in case SDK delete fails on RecordId
      await db.query("DELETE vote WHERE target_kind = $kind AND target_key = $key AND user_sub = $sub;", {
        kind,
        key,
        sub,
      });
    }
  } else {
    try {
      await db.upsert(recId).merge({
        target_kind: kind,
        target_key: key,
        user_sub: sub,
        value,
        updated_at: now,
      });
    } catch {
      await db.query(
        "UPSERT $recId CONTENT { target_kind: $kind, target_key: $key, user_sub: $sub, value: $value, updated_at: $now };",
        { recId, kind, key, sub, value, now }
      );
    }
  }

  // Fetch updated aggregated score
  let score = 0;
  let up = 0;
  let down = 0;
  try {
    const aggRes = await db.query(
      "SELECT math::sum(value) AS score, count(value = 1) AS up, count(value = -1) AS down FROM vote WHERE target_kind = $kind AND target_key = $key GROUP ALL;",
      { kind, key }
    );
    const rows = Array.isArray(aggRes) ? (Array.isArray(aggRes[0]) ? aggRes[0] : aggRes) : [];
    const r = rows[0];
    if (r) {
      score = Number(r.score || 0);
      up = Number(r.up || 0);
      down = Number(r.down || 0);
    }
  } catch (err: any) {
    logger.warn(`[Votes] Failed to fetch aggregate after vote: ${err.message}`);
  }

  return {
    score,
    up,
    down,
    myVote: value,
    canVote: true,
  };
}

/**
 * Fetch vote summaries for multiple keys in bulk.
 */
export async function getVoteSummaries(
  db: any,
  kind: VoteKind,
  rawKeys: string[],
  sub: string | null
): Promise<Map<string, VoteSummary>> {
  const map = new Map<string, VoteSummary>();
  const keys = Array.from(new Set(rawKeys.map(voteKey).filter(Boolean)));
  if (keys.length === 0) return map;

  // Initialize with empty summaries
  const canVote = Boolean(sub && sub !== "anonymous");
  for (const k of keys) {
    map.set(k, { score: 0, up: 0, down: 0, myVote: 0, canVote });
  }

  try {
    // 1. Aggregated totals per target
    const aggRes = await db.query(
      "SELECT target_key, math::sum(value) AS score, count(value = 1) AS up, count(value = -1) AS down FROM vote WHERE target_kind = $kind AND target_key IN $keys GROUP BY target_key;",
      { kind, keys }
    );
    const aggRows = Array.isArray(aggRes) ? (Array.isArray(aggRes[0]) ? aggRes[0] : aggRes) : [];
    for (const r of aggRows) {
      if (!r?.target_key) continue;
      const existing = map.get(r.target_key) || { score: 0, up: 0, down: 0, myVote: 0, canVote };
      existing.score = Number(r.score || 0);
      existing.up = Number(r.up || 0);
      existing.down = Number(r.down || 0);
      map.set(r.target_key, existing);
    }

    // 2. User's personal votes (if logged in)
    if (canVote && sub) {
      const userRes = await db.query(
        "SELECT target_key, value FROM vote WHERE target_kind = $kind AND target_key IN $keys AND user_sub = $sub;",
        { kind, keys, sub }
      );
      const userRows = Array.isArray(userRes) ? (Array.isArray(userRes[0]) ? userRes[0] : userRes) : [];
      for (const r of userRows) {
        if (!r?.target_key) continue;
        const existing = map.get(r.target_key);
        if (existing) {
          existing.myVote = (r.value === 1 ? 1 : r.value === -1 ? -1 : 0) as VoteValue;
        }
      }
    }
  } catch (err: any) {
    logger.warn(`[Votes] Bulk query failed for ${kind}: ${err.message}`);
  }

  return map;
}

/**
 * Attaches vote summaries to a list of items (dashboards or workflows).
 */
export async function attachVoteSummaries<T extends { id?: any }>(
  db: any,
  kind: VoteKind,
  items: T[],
  ctx: { sub?: string } | null
): Promise<(T & { votes: VoteSummary })[]> {
  if (!items || items.length === 0) return [];
  const keys = items.map((i) => voteKey(i.id));
  const sub = ctx && ctx.sub && ctx.sub !== "anonymous" ? ctx.sub : null;
  const summaries = await getVoteSummaries(db, kind, keys, sub);

  return items.map((item) => {
    const k = voteKey(item.id);
    const votes = summaries.get(k) || {
      score: 0,
      up: 0,
      down: 0,
      myVote: 0,
      canVote: Boolean(sub),
    };
    return {
      ...item,
      votes,
    };
  });
}

/**
 * Deletes all votes for a given dashboard or workflow key upon deletion.
 */
export async function deleteVotesForTarget(db: any, kind: VoteKind, rawKey: string): Promise<void> {
  const key = voteKey(rawKey);
  if (!key) return;
  try {
    await db.query("DELETE vote WHERE target_kind = $kind AND target_key = $key;", { kind, key });
  } catch (err: any) {
    logger.warn(`[Votes] Failed to cascade delete votes for ${kind} ${key}: ${err.message}`);
  }
}
