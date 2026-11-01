import { describe, expect, it } from "bun:test";
import { buildMemberRecordKey, collectAllExistingGroups } from "./groups";

describe("groups domain utilities", () => {
  it("buildMemberRecordKey produces lowercase normalized key", () => {
    expect(buildMemberRecordKey("Dev-Team", "Alice")).toBe("dev-team__alice");
    expect(buildMemberRecordKey("   Ops_Group  ", "  Bob.Smith ")).toBe("ops_group__bob.smith");
  });

  it("collectAllExistingGroups gathers unique group names across tables and skips public/empty", async () => {
    const mockDb = {
      query: async (sql: string) => {
        if (sql.includes("group_namespace")) {
          return [[{ name: "Engineering" }, { name: "Design" }, { name: "public" }]];
        }
        if (sql.includes("group_member")) {
          return [[{ group: "marketing" }, { group: "Engineering" }]];
        }
        if (sql.includes("dashboard")) {
          return [[{ tags: ["sales:admin", "engineering:write", "public"] }]];
        }
        if (sql.includes("workflow")) {
          return [[{ tags: ["workflows-team", "public"] }]];
        }
        return [[]];
      },
    };

    const groups = await collectAllExistingGroups(mockDb);
    expect(groups.has("engineering")).toBe(true);
    expect(groups.has("design")).toBe(true);
    expect(groups.has("marketing")).toBe(true);
    expect(groups.has("sales")).toBe(true);
    expect(groups.has("workflows-team")).toBe(true);
    expect(groups.has("public")).toBe(false);
  });

  it("collectAllExistingGroups is resilient when queries throw", async () => {
    const throwingDb = {
      query: async () => {
        throw new Error("Table not found");
      },
    };

    const groups = await collectAllExistingGroups(throwingDb);
    expect(groups.size).toBe(0);
  });
});
