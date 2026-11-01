import { describe, expect, it } from "bun:test";
import { buildMemberRecordKey, collectAllExistingGroups, deleteGroupCascade } from "./groups";

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

  it("deleteGroupCascade removes target group and sub-groups across namespaces, members, and resource tags", async () => {
    const deletedQueries: string[] = [];
    const updateQueries: { sql: string; params: any }[] = [];

    const mockDb = {
      query: async (sql: string, params?: any) => {
        if (sql.includes("SELECT name FROM group_namespace")) {
          return [[{ name: "group1" }, { name: "group1.sub1" }, { name: "group2" }]];
        }
        if (sql.includes("SELECT group FROM group_member")) {
          return [[{ group: "group1.sub2" }, { group: "group2" }]];
        }
        if (sql.startsWith("DELETE")) {
          deletedQueries.push(sql);
          return [[]];
        }
        if (sql.includes("SELECT id, tags FROM dashboard")) {
          return [[{ id: "dashboard:d1", tags: ["group1:write", "other_team", "public"] }]];
        }
        if (sql.includes("SELECT id, tags FROM")) {
          return [[]];
        }
        if (sql.startsWith("UPDATE")) {
          updateQueries.push({ sql, params });
          return [[]];
        }
        return [[]];
      },
    };

    const result = await deleteGroupCascade(mockDb, "group1");
    expect(result.deletedGroup).toBe("group1");
    expect(result.deletedSubGroups).toContain("group1.sub1");
    expect(result.deletedSubGroups).toContain("group1.sub2");
    expect(result.deletedSubGroups).not.toContain("group2");
    expect(result.removedFromResources).toBe(1);

    // Verify tag update stripped group1
    const tagUpdate = updateQueries.find((u) => u.params?.id === "dashboard:d1");
    expect(tagUpdate).toBeDefined();
    expect(tagUpdate?.params?.tags).toEqual(["other_team", "public"]);
  });
});

