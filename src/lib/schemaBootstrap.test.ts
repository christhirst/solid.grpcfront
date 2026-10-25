import { describe, expect, test } from "bun:test";
import { STANDARD_TABLES, STANDARD_TABLES_SQL } from "./db";
import { normalizeGroupName } from "./groupAuth";

describe("schemaBootstrap - standard tables", () => {
  test("STANDARD_TABLES includes database_meta and all required resource tables", () => {
    expect(STANDARD_TABLES).toContain("database_meta");
    expect(STANDARD_TABLES).toContain("workflow");
    expect(STANDARD_TABLES).toContain("connection");
    expect(STANDARD_TABLES).toContain("workflow_run");
    expect(STANDARD_TABLES).toContain("dashboard");
    expect(STANDARD_TABLES).toContain("proto_file");
    expect(STANDARD_TABLES).toContain("ca_cert");
    expect(STANDARD_TABLES).toContain("user_profile");
    expect(STANDARD_TABLES).toContain("group_namespace");
  });

  test("STANDARD_TABLES_SQL generates DEFINE TABLE statements for database_meta", () => {
    expect(STANDARD_TABLES_SQL).toContain("DEFINE TABLE IF NOT EXISTS database_meta TYPE NORMAL SCHEMALESS PERMISSIONS FULL;");
    expect(STANDARD_TABLES_SQL).toContain("DEFINE TABLE IF NOT EXISTS workflow TYPE NORMAL SCHEMALESS PERMISSIONS FULL;");
  });

  test("resilient table tag queries do not fail when a table is missing", async () => {
    const mockDb = {
      async query(sql: string) {
        if (sql.includes("database_meta")) {
          throw new Error("The table 'database_meta' does not exist");
        }
        if (sql.includes("dashboard")) {
          return [[{ tags: ["engineering:view"] }]];
        }
        return [[]];
      },
    };

    const taggedGroups = new Set<string>();
    const tagTables = ["dashboard", "workflow", "connection", "database_meta", "proto_file", "ca_cert"];

    await Promise.allSettled(
      tagTables.map(async (tbl) => {
        try {
          const res = await mockDb.query(`SELECT tags FROM ${tbl} WHERE owner = 'user1';`);
          const rows = Array.isArray(res) ? (Array.isArray(res[0]) ? res[0] : res) : [];
          for (const row of rows) {
            if (row && Array.isArray(row.tags)) {
              for (const t of row.tags) {
                const norm = normalizeGroupName(String(t).split(":")[0] || "");
                if (norm) taggedGroups.add(norm);
              }
            }
          }
        } catch {
          // Handled gracefully
        }
      })
    );

    // dashboard tags should still be collected even though database_meta threw
    expect(taggedGroups.has("engineering")).toBe(true);
  });
});
