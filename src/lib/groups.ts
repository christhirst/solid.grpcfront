import { PUBLIC_TAG, normalizeGroupName } from "~/lib/groupAuth";

export function buildMemberRecordKey(groupName: string, username: string): string {
  return `${normalizeGroupName(groupName)}__${username.trim().toLowerCase()}`;
}

export async function collectAllExistingGroups(db: any): Promise<Set<string>> {
  const existing = new Set<string>();

  // 1. Group namespaces
  try {
    const nsRes = await db.query(`SELECT name FROM group_namespace;`);
    const groupRows = Array.isArray(nsRes) ? (Array.isArray(nsRes[0]) ? nsRes[0] : nsRes) : [];
    for (const r of groupRows) {
      const n = normalizeGroupName(String(r?.name || ""));
      if (n && n !== PUBLIC_TAG) existing.add(n);
    }
  } catch {
    // Table may not exist yet
  }

  // 2. Group member assignments
  try {
    const memRes = await db.query(`SELECT group FROM group_member;`);
    const memRows = Array.isArray(memRes) ? (Array.isArray(memRes[0]) ? memRes[0] : memRes) : [];
    for (const r of memRows) {
      const n = normalizeGroupName(String(r?.group || ""));
      if (n && n !== PUBLIC_TAG) existing.add(n);
    }
  } catch {
    // Table may not exist yet
  }

  // 3. Resource tags across tables
  const tagTables = ["dashboard", "workflow", "connection", "database_meta", "proto_file", "ca_cert"];
  await Promise.allSettled(
    tagTables.map(async (tbl) => {
      try {
        const res = await db.query(`SELECT tags FROM ${tbl};`);
        const rows = Array.isArray(res) ? (Array.isArray(res[0]) ? res[0] : res) : [];
        for (const r of rows) {
          if (Array.isArray(r?.tags)) {
            for (const t of r.tags) {
              const norm = normalizeGroupName(String(t).split(":")[0] || "");
              if (norm && norm !== PUBLIC_TAG) existing.add(norm);
            }
          }
        }
      } catch {
        // Table may not exist yet
      }
    })
  );

  return existing;
}
