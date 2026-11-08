import { describe, expect, it } from "bun:test";
import {
  normalizeVoteValue,
  nextVoteValue,
  applyVoteChange,
  compareByVotes,
  voteKey,
  castVote,
  getVoteSummaries,
  attachVoteSummaries,
  type VoteSummary,
} from "./votes";

describe("votes domain helpers", () => {
  it("normalizeVoteValue correctly parses numbers, strings, and words", () => {
    expect(normalizeVoteValue(1)).toBe(1);
    expect(normalizeVoteValue("1")).toBe(1);
    expect(normalizeVoteValue("up")).toBe(1);

    expect(normalizeVoteValue(-1)).toBe(-1);
    expect(normalizeVoteValue("-1")).toBe(-1);
    expect(normalizeVoteValue("down")).toBe(-1);

    expect(normalizeVoteValue(0)).toBe(0);
    expect(normalizeVoteValue("0")).toBe(0);
    expect(normalizeVoteValue("none")).toBe(0);
    expect(normalizeVoteValue("clear")).toBe(0);
    expect(normalizeVoteValue(null)).toBe(0);

    expect(normalizeVoteValue("invalid")).toBeNull();
    expect(normalizeVoteValue(42)).toBeNull();
  });

  it("nextVoteValue toggles when clicking same arrow and switches when clicking opposite", () => {
    // Current is 0 (no vote)
    expect(nextVoteValue(0, 1)).toBe(1);
    expect(nextVoteValue(0, -1)).toBe(-1);

    // Current is 1 (upvoted)
    expect(nextVoteValue(1, 1)).toBe(0); // re-click up removes vote
    expect(nextVoteValue(1, -1)).toBe(-1); // click down switches to down

    // Current is -1 (downvoted)
    expect(nextVoteValue(-1, -1)).toBe(0); // re-click down removes vote
    expect(nextVoteValue(-1, 1)).toBe(1); // click up switches to up
  });

  it("applyVoteChange computes optimistic score, up, down, and myVote", () => {
    const initial: VoteSummary = {
      score: 5,
      up: 6,
      down: 1,
      myVote: 0,
      canVote: true,
    };

    // Upvote
    const afterUp = applyVoteChange(initial, 1);
    expect(afterUp.score).toBe(6);
    expect(afterUp.up).toBe(7);
    expect(afterUp.down).toBe(1);
    expect(afterUp.myVote).toBe(1);

    // Switch from up to down
    const afterDown = applyVoteChange(afterUp, -1);
    expect(afterDown.score).toBe(4);
    expect(afterDown.up).toBe(6);
    expect(afterDown.down).toBe(2);
    expect(afterDown.myVote).toBe(-1);

    // Remove downvote
    const afterRemove = applyVoteChange(afterDown, 0);
    expect(afterRemove.score).toBe(5);
    expect(afterRemove.up).toBe(6);
    expect(afterRemove.down).toBe(1);
    expect(afterRemove.myVote).toBe(0);
  });

  it("voteKey strips chevrons and prefixes correctly", () => {
    expect(voteKey("dashboard:dash_123")).toBe("dash_123");
    expect(voteKey("⟨workflow:wf_abc⟩")).toBe("wf_abc");
    expect(voteKey("simple_id")).toBe("simple_id");
  });

  it("compareByVotes sorts items by score desc, then upvotes desc, then updated_at desc", () => {
    const itemA = { id: "a", votes: { score: 10, up: 12 }, updated_at: "2026-01-01T00:00:00Z" };
    const itemB = { id: "b", votes: { score: 15, up: 15 }, updated_at: "2026-01-01T00:00:00Z" };
    const itemC = { id: "c", votes: { score: 10, up: 14 }, updated_at: "2026-01-01T00:00:00Z" };
    const itemD = { id: "d", votes: { score: 10, up: 12 }, updated_at: "2026-01-02T00:00:00Z" };

    const sorted = [itemA, itemB, itemC, itemD].sort(compareByVotes);
    expect(sorted[0].id).toBe("b"); // score 15
    expect(sorted[1].id).toBe("c"); // score 10, up 14
    expect(sorted[2].id).toBe("d"); // score 10, up 12, newer updated_at
    expect(sorted[3].id).toBe("a"); // score 10, up 12, older updated_at
  });
});

describe("votes database interactions with mock DB", () => {
  it("getVoteSummaries and attachVoteSummaries handle aggregated results and user votes", async () => {
    const mockDb = {
      async query(sql: string, vars: any) {
        if (sql.includes("math::sum")) {
          return [
            [
              { target_key: "dash_1", score: 3, up: 4, down: 1 },
              { target_key: "dash_2", score: -1, up: 0, down: 1 },
            ],
          ];
        }
        if (sql.includes("user_sub = $sub")) {
          return [
            [
              { target_key: "dash_1", value: 1 },
            ],
          ];
        }
        return [[]];
      },
    };

    const items = [
      { id: "dashboard:dash_1", name: "Board 1" },
      { id: "dashboard:dash_2", name: "Board 2" },
      { id: "dashboard:dash_3", name: "Board 3" },
    ];

    const ctx = { sub: "alice" };
    const attached = await attachVoteSummaries(mockDb, "dashboard", items, ctx);

    expect(attached.length).toBe(3);
    const d1 = attached.find((i) => i.id.includes("dash_1"));
    expect(d1?.votes.score).toBe(3);
    expect(d1?.votes.up).toBe(4);
    expect(d1?.votes.down).toBe(1);
    expect(d1?.votes.myVote).toBe(1);
    expect(d1?.votes.canVote).toBe(true);

    const d2 = attached.find((i) => i.id.includes("dash_2"));
    expect(d2?.votes.score).toBe(-1);
    expect(d2?.votes.myVote).toBe(0);

    const d3 = attached.find((i) => i.id.includes("dash_3"));
    expect(d3?.votes.score).toBe(0);
    expect(d3?.votes.myVote).toBe(0);
  });

  it("castVote removes vote when value is 0", async () => {
    let deleted = false;
    let upserted = false;
    const mockDb = {
      async delete(_id: any) {
        deleted = true;
      },
      upsert(_id: any) {
        return {
          async merge(_data: any) {
            upserted = true;
          },
        };
      },
      async query(sql: string) {
        if (sql.includes("DELETE")) deleted = true;
        return [[{ score: 0, up: 0, down: 0 }]];
      },
    };

    const summary = await castVote(mockDb, "dashboard", "dash_test", "alice", 0);
    expect(deleted).toBe(true);
    expect(upserted).toBe(false);
    expect(summary.myVote).toBe(0);
  });
});
