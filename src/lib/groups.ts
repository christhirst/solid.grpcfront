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

export interface GroupCascadeDeleteResult {
  deletedGroup: string;
  deletedSubGroups: string[];
  removedFromResources: number;
}

/**
 * Cascade-deletes a group/space across SurrealDB:
 * 1. Finds the group and all its sub-groups (e.g. group1.sub1, group1.sub2).
 * 2. Deletes records from group_namespace.
 * 3. Deletes records from group_member.
 * 4. Removes matching group tags from resource tables (dashboard, workflow, connection, database_meta, proto_file, ca_cert).
 * 5. Cleans up ownerGroup on publish_namespace.
 */
export async function deleteGroupCascade(db: any, rawGroupName: string): Promise<GroupCascadeDeleteResult> {
  const root = normalizeGroupName(rawGroupName);
  if (!root || root === PUBLIC_TAG) {
    return { deletedGroup: root, deletedSubGroups: [], removedFromResources: 0 };
  }

  // Determine all groups to delete: root + any hierarchical children
  const prefix = `${root}.`;
  const targets = new Set<string>([root]);

  try {
    const nsRes = await db.query(`SELECT name FROM group_namespace;`);
    const rows = Array.isArray(nsRes) ? (Array.isArray(nsRes[0]) ? nsRes[0] : nsRes) : [];
    for (const r of rows) {
      const n = normalizeGroupName(String(r?.name || ""));
      if (n && (n === root || n.startsWith(prefix))) {
        targets.add(n);
      }
    }
  } catch {
    // Ignore
  }

  try {
    const memRes = await db.query(`SELECT group FROM group_member;`);
    const rows = Array.isArray(memRes) ? (Array.isArray(memRes[0]) ? memRes[0] : memRes) : [];
    for (const r of rows) {
      const g = normalizeGroupName(String(r?.group || ""));
      if (g && (g === root || g.startsWith(prefix))) {
        targets.add(g);
      }
    }
  } catch {
    // Ignore
  }

  const allTargets = Array.from(targets);
  const subGroups = allTargets.filter((t) => t !== root);

  // 1. Delete group_namespace entries
  await Promise.allSettled(
    allTargets.map(async (t) => {
      try {
        await db.query(`DELETE group_namespace WHERE name = $name OR id = $id;`, {
          name: t,
          id: `group_namespace:${t}`,
        });
      } catch {
        // Ignore
      }
    })
  );

  // 2. Delete group_member entries
  await Promise.allSettled(
    allTargets.map(async (t) => {
      try {
        await db.query(`DELETE FROM group_member WHERE group = $group;`, { group: t });
      } catch {
        // Ignore
      }
    })
  );

  // 3. Remove group tags from resource tables
  let removedFromResources = 0;
  const tagTables = ["dashboard", "workflow", "connection", "database_meta", "proto_file", "ca_cert"];
  await Promise.allSettled(
    tagTables.map(async (tbl) => {
      try {
        const res = await db.query(`SELECT id, tags FROM ${tbl};`);
        const rows = Array.isArray(res) ? (Array.isArray(res[0]) ? res[0] : res) : [];
        for (const row of rows) {
          if (!row?.id || !Array.isArray(row.tags)) continue;
          let changed = false;
          const nextTags = row.tags.filter((t: any) => {
            const norm = normalizeGroupName(String(t).split(":")[0] || "");
            const isMatch = norm === root || norm.startsWith(prefix);
            if (isMatch) changed = true;
            return !isMatch;
          });
          if (changed) {
            removedFromResources++;
            const now = new Date().toISOString();
            await db.query(`UPDATE $id MERGE { tags: $tags, updated_at: $now };`, {
              id: row.id,
              tags: nextTags,
              now,
            });
          }
        }
      } catch {
        // Table may not exist yet
      }
    })
  );

  // 4. Clean up publish_namespace ownerGroup
  try {
    for (const t of allTargets) {
      await db.query(
        `UPDATE publish_namespace SET ownerType = 'user', ownerGroup = NONE WHERE ownerGroup = $grp;`,
        { grp: t }
      );
    }
  } catch {
    // Ignore
  }

  return {
    deletedGroup: root,
    deletedSubGroups: subGroups,
    removedFromResources,
  };
}

