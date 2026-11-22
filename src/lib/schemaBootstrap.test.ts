import { describe, expect, test } from "bun:test";
import {
  isVersionSupported,
  MAXIMUM_VERSION,
  RecordId,
  StringRecordId,
  Table,
} from "surrealdb";
import {
  STANDARD_TABLES,
  STANDARD_TABLES_SQL,
  buildSurrealAuthAttempts,
  normalizeSurrealAuthLevel,
  normalizeThing,
  resourceName,
} from "./db";
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
    expect(STANDARD_TABLES).toContain("vote");
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

describe("SurrealDB user scope / authLevel", () => {
  test("normalizeSurrealAuthLevel normalizes valid values and aliases", () => {
    expect(normalizeSurrealAuthLevel("namespace")).toBe("namespace");
    expect(normalizeSurrealAuthLevel("ns")).toBe("namespace");
    expect(normalizeSurrealAuthLevel("database")).toBe("database");
    expect(normalizeSurrealAuthLevel("db")).toBe("database");
    expect(normalizeSurrealAuthLevel("root")).toBe("root");
    expect(normalizeSurrealAuthLevel("auto")).toBe("auto");
    expect(normalizeSurrealAuthLevel(undefined)).toBe("auto");
    expect(normalizeSurrealAuthLevel("unknown")).toBe("auto");
  });

  test("buildSurrealAuthAttempts places namespace sign-in first when authLevel is 'namespace'", () => {
    const attempts = buildSurrealAuthAttempts("agent_de", "secret", "Europe", "DE", "namespace");
    expect(attempts.length).toBe(3);
    expect(attempts[0]).toEqual({
      namespace: "Europe",
      username: "agent_de",
      password: "secret",
    });
    expect(attempts[1]).toEqual({
      namespace: "Europe",
      database: "DE",
      username: "agent_de",
      password: "secret",
    });
    expect(attempts[2]).toEqual({
      username: "agent_de",
      password: "secret",
    });
  });

  test("buildSurrealAuthAttempts places database sign-in first when authLevel is 'database'", () => {
    const attempts = buildSurrealAuthAttempts("db_user", "secret", "Europe", "DE", "database");
    expect(attempts[0]).toEqual({
      namespace: "Europe",
      database: "DE",
      username: "db_user",
      password: "secret",
    });
    expect(attempts[1]).toEqual({
      namespace: "Europe",
      username: "db_user",
      password: "secret",
    });
    expect(attempts[2]).toEqual({
      username: "db_user",
      password: "secret",
    });
  });

  test("buildSurrealAuthAttempts places root sign-in first when authLevel is 'root'", () => {
    const attempts = buildSurrealAuthAttempts("admin", "secret", "Europe", "DE", "root");
    expect(attempts[0]).toEqual({
      username: "admin",
      password: "secret",
    });
    expect(attempts[1]).toEqual({
      namespace: "Europe",
      username: "admin",
      password: "secret",
    });
    expect(attempts[2]).toEqual({
      namespace: "Europe",
      database: "DE",
      username: "admin",
      password: "secret",
    });
  });

  test("buildSurrealAuthAttempts in 'auto' mode includes database, namespace, and root in order for non-root users", () => {
    const attempts = buildSurrealAuthAttempts("agent_de", "secret", "Europe", "DE", "auto");
    expect(attempts).toEqual([
      { namespace: "Europe", database: "DE", username: "agent_de", password: "secret" },
      { namespace: "Europe", username: "agent_de", password: "secret" },
      { username: "agent_de", password: "secret" },
    ]);
  });

  test("buildSurrealAuthAttempts in 'auto' mode prioritizes root when username is 'root'", () => {
    const attempts = buildSurrealAuthAttempts("root", "secret", "Europe", "DE", "auto");
    expect(attempts).toEqual([
      { username: "root", password: "secret" },
      { namespace: "Europe", username: "root", password: "secret" },
      { namespace: "Europe", database: "DE", username: "root", password: "secret" },
    ]);
  });
});

describe("SurrealDB v4 SDK compatibility", () => {
  test("SDK accepts both SurrealDB v3 and v4 engine versions", () => {
    expect(MAXIMUM_VERSION).toBe("5.0.0");
    expect(isVersionSupported("surrealdb-4.0.1")).toBe(true);
    expect(isVersionSupported("surrealdb-3.3.5")).toBe(true);
  });

  test("normalizeThing wraps plain table names in Table and record strings in StringRecordId", () => {
    const tbl = normalizeThing("connection");
    expect(tbl).toBeInstanceOf(Table);
    expect(String(tbl)).toBe("connection");

    const strRec = normalizeThing("connection:123");
    expect(strRec).toBeInstanceOf(StringRecordId);
    expect(String(strRec)).toBe("connection:123");

    const recId = new RecordId("connection", "123");
    expect(normalizeThing(recId)).toBe(recId);
  });

  test("resourceName extracts table names from RecordId and Table instances", () => {
    expect(resourceName(new RecordId("workflow", "abc"))).toBe("workflow");
    expect(resourceName(new Table("connection"))).toBe("connection");
    expect(resourceName("dashboard:xyz")).toBe("dashboard");
  });
});
