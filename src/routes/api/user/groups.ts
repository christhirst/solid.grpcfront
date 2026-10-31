import type { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getAuthUser, getEffectiveAccessContext } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { ensurePublishingSchema } from "~/lib/dashboard/publishing";
import {
  canCreateGroupNamespace,
  formatGroupClaim,
  groupCoversTag,
  hasGroupRight,
  normalizeGroupName,
  parseGroupClaim,
  type GroupRight,
} from "~/lib/groupAuth";
import { readJsonBody } from "~/lib/requestUtils";

async function collectAllExistingGroups(db: any): Promise<Set<string>> {
  const existing = new Set<string>();

  // 1. Group namespaces
  try {
    const nsRes = await db.query(`SELECT name FROM group_namespace;`);
    const groupRows = Array.isArray(nsRes) ? (Array.isArray(nsRes[0]) ? nsRes[0] : nsRes) : [];
    for (const r of groupRows) {
      if (r?.name) existing.add(normalizeGroupName(String(r.name)));
    }
  } catch {
    // group_namespace might not exist yet
  }

  // 2. Group member assignments
  try {
    const memRes = await db.query(`SELECT group FROM group_member;`);
    const memRows = Array.isArray(memRes) ? (Array.isArray(memRes[0]) ? memRes[0] : memRes) : [];
    for (const r of memRows) {
      if (r?.group) existing.add(normalizeGroupName(String(r.group)));
    }
  } catch {
    // group_member might not exist yet
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
              if (norm) existing.add(norm);
            }
          }
        }
      } catch {
        // Table might not exist yet
      }
    })
  );

  return existing;
}

function buildMemberRecordKey(groupName: string, username: string): string {
  return `${normalizeGroupName(groupName)}__${username.trim().toLowerCase()}`;
}

export async function GET(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  try {
    const db = await getDb();
    await ensurePublishingSchema(db);
    const [ctx, existingSet] = await Promise.all([
      getEffectiveAccessContext(event.request, db),
      collectAllExistingGroups(db),
    ]);

    let nsRecords: any[] = [];
    try {
      const res = await db.query("SELECT * FROM group_namespace ORDER BY name ASC;");
      nsRecords = Array.isArray(res?.[0]) ? res[0] : [];
    } catch {
      nsRecords = [];
    }

    let memberRecords: any[] = [];
    try {
      const memRes = await db.query("SELECT * FROM group_member ORDER BY group ASC, username ASC;");
      memberRecords = Array.isArray(memRes?.[0]) ? memRes[0] : [];
    } catch {
      memberRecords = [];
    }

    // Build map of group_namespace records, synthesizing entries for groups that exist via members/grants
    const groupMap = new Map<string, any>();
    for (const g of nsRecords) {
      const normName = normalizeGroupName(g.name || "");
      if (!normName) continue;
      groupMap.set(normName, {
        ...g,
        id: g.id?.toString().replace(/[⟨⟩]/g, ""),
        name: normName,
      });
    }
    for (const grant of ctx.allGrants) {
      if (!groupMap.has(grant.group)) {
        const segments = grant.group.split(".");
        groupMap.set(grant.group, {
          id: `group_namespace:${grant.group}`,
          name: grant.group,
          parent: segments.length > 1 ? segments.slice(0, -1).join(".") : null,
          owner: user.sub,
          description: "",
        });
      }
    }

    const membersByGroup: Record<string, any[]> = {};
    for (const m of memberRecords) {
      const grp = normalizeGroupName(m.group || "");
      if (!grp) continue;
      if (!membersByGroup[grp]) membersByGroup[grp] = [];
      membersByGroup[grp].push({
        id: m.id?.toString().replace(/[⟨⟩]/g, ""),
        group: grp,
        username: m.username || m.userSub || "",
        userSub: m.userSub || undefined,
        displayName: m.displayName || m.username || m.userSub || "",
        rights: Array.isArray(m.rights) ? m.rights : ["view", "use"],
        claim: formatGroupClaim(grp, Array.isArray(m.rights) ? m.rights : ["view", "use"]),
        assignedBy: m.assignedBy || "",
        updated_at: m.updated_at || m.created_at || "",
      });
    }

    const visibleGroups = [...groupMap.values()]
      .filter((g) => {
        if (ctx.isAdmin) return true;
        if (g.owner === user.sub && !ctx.disableOwnerBypass) return true;
        const normName = normalizeGroupName(g.name || "");
        return ctx.activeGrants.some(
          (grant) => groupCoversTag(grant.group, normName) || groupCoversTag(normName, grant.group)
        );
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((g) => {
        const canManage = hasGroupRight(ctx, g.name, "manager");
        const canUse = hasGroupRight(ctx, g.name, "use");
        return {
          ...g,
          canManage,
          canUse,
          members: membersByGroup[g.name] || [],
        };
      });

    // Known users registered in user_profile (for easy selection when assigning space rights)
    let knownUsers: { sub: string; username: string; name?: string; email?: string; idpRole?: string }[] = [];
    if (ctx.capabilities.canManageGroups || ctx.isAdmin) {
      try {
        const uRes = await db.query(
          "SELECT sub, username, name, email, idpRole FROM user_profile ORDER BY username ASC LIMIT 200;"
        );
        const uRows = Array.isArray(uRes?.[0]) ? uRes[0] : [];
        knownUsers = uRows
          .filter((u: any) => u && (u.username || u.sub))
          .map((u: any) => ({
            sub: String(u.sub || ""),
            username: String(u.username || u.name || u.sub || ""),
            name: u.name ? String(u.name) : undefined,
            email: u.email ? String(u.email) : undefined,
            idpRole: u.idpRole ? String(u.idpRole) : undefined,
          }));
      } catch {
        knownUsers = [];
      }
    }

    return Response.json({
      success: true,
      data: {
        groups: visibleGroups,
        existingGroupNames: [...existingSet].sort(),
        knownUsers,
      },
    });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err?.message || "Failed to load spaces and groups." },
      { status: 500 }
    );
  }
}

export async function POST(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }

  try {
    const db = await getDb();
    await ensurePublishingSchema(db);
    const body = await readJsonBody(event);
    const action = body.action || "create";

    const ctx = await getEffectiveAccessContext(event.request, db);

    if (!ctx.capabilities.canManageGroups && !ctx.isAdmin) {
      return Response.json(
        { success: false, error: "Your platform role (viewer) does not permit managing spaces or group rights." },
        { status: 403 }
      );
    }

    // 1. CREATE SPACE / GROUP IN SURREALDB
    if (action === "create") {
      const existingSet = await collectAllExistingGroups(db);
      const validation = canCreateGroupNamespace(ctx, body.groupName || "", existingSet);
      if (!validation.allowed) {
        return Response.json(
          { success: false, error: validation.error || "Cannot create space/group." },
          { status: 403 }
        );
      }

      const now = new Date().toISOString();
      const groupName = validation.normalized;
      const recordId = new RecordId("group_namespace", groupName);

      const groupRecord = {
        name: groupName,
        parent: validation.parent,
        owner: user.sub,
        description: typeof body.description === "string" ? body.description.trim() : "",
        created_at: now,
        updated_at: now,
      };

      await db.query(`UPSERT $id CONTENT $data;`, {
        id: recordId,
        data: groupRecord,
      });

      // Permanently grant creator manager rights on this space in SurrealDB group_member
      const creatorUsername = (user.username || user.name || user.sub).trim();
      const memberId = new RecordId("group_member", buildMemberRecordKey(groupName, creatorUsername));
      const allRights: GroupRight[] = ["view", "use", "write", "delete", "manager"];

      await db.query(`UPSERT $id CONTENT $data;`, {
        id: memberId,
        data: {
          group: groupName,
          username: creatorUsername.toLowerCase(),
          displayName: creatorUsername,
          userSub: user.sub,
          rights: allRights,
          assignedBy: user.sub,
          created_at: now,
          updated_at: now,
        },
      });

      const updatedCtx = await getEffectiveAccessContext(event.request, db);
      return Response.json({
        success: true,
        data: {
          group: groupRecord,
          claim: `${groupName}:manager`,
          allGrants: updatedCtx.allGrants,
          activeGrants: updatedCtx.activeGrants,
        },
      });
    }

    // 2. ASSIGN / UPDATE MEMBER RIGHTS IN SURREALDB
    if (action === "assign_member") {
      const groupName = normalizeGroupName(body.groupName || "");
      if (!groupName) {
        return Response.json({ success: false, error: "Space / group name is required." }, { status: 400 });
      }

      if (!hasGroupRight(ctx, groupName, "manager") && !ctx.isAdmin) {
        return Response.json(
          {
            success: false,
            error: `You need "${groupName}:manager" permission to manage member rights for this space.`,
          },
          { status: 403 }
        );
      }

      const rawTarget = typeof body.targetUsername === "string" ? body.targetUsername.trim() : "";
      if (!rawTarget) {
        return Response.json(
          { success: false, error: "Target username or user ID is required." },
          { status: 400 }
        );
      }

      // Normalize & expand requested rights using parseGroupClaim
      const rightsInput = body.rights || ["view", "use"];
      const rightsStr = Array.isArray(rightsInput) ? `(${rightsInput.join(",")})` : String(rightsInput);
      const parsedClaim = parseGroupClaim(`${groupName}:${rightsStr}`, "db");
      const effectiveRights: GroupRight[] = parsedClaim?.rights?.length
        ? parsedClaim.rights
        : ["view", "use"];
      const fullClaim = formatGroupClaim(groupName, effectiveRights);

      // Look up if target user already exists in user_profile
      let resolvedSub: string | undefined;
      let displayName = rawTarget;
      let canonicalUsername = rawTarget.toLowerCase();
      try {
        const targetLower = rawTarget.toLowerCase();
        const uRes = await db.query(
          `SELECT sub, username, name, email FROM user_profile WHERE
            sub = $raw
            OR string::lowercase(username ?? '') = $targetLower
            OR string::lowercase(email ?? '') = $targetLower
          LIMIT 1;`,
          { raw: rawTarget, targetLower }
        );
        const matchedUser = Array.isArray(uRes?.[0]) ? uRes[0][0] : undefined;
        if (matchedUser) {
          resolvedSub = String(matchedUser.sub || "");
          displayName = String(matchedUser.username || matchedUser.name || rawTarget);
          canonicalUsername = String(matchedUser.username || rawTarget).toLowerCase();
        }
      } catch {
        // Ignore lookup error
      }

      const now = new Date().toISOString();

      // Ensure the group_namespace record exists in SurrealDB
      const nsId = new RecordId("group_namespace", groupName);
      const existingNsRes = await db.select(nsId).catch(() => null);
      const existingNs = Array.isArray(existingNsRes) ? existingNsRes[0] : existingNsRes;
      if (!existingNs) {
        const segments = groupName.split(".");
        await db.query(`UPSERT $id CONTENT $data;`, {
          id: nsId,
          data: {
            name: groupName,
            parent: segments.length > 1 ? segments.slice(0, -1).join(".") : null,
            owner: user.sub,
            description: "",
            created_at: now,
            updated_at: now,
          },
        });
      }

      const memberId = new RecordId("group_member", buildMemberRecordKey(groupName, canonicalUsername));
      const memberData = {
        group: groupName,
        username: canonicalUsername,
        displayName,
        userSub: resolvedSub,
        rights: effectiveRights,
        assignedBy: user.sub,
        created_at: now,
        updated_at: now,
      };

      await db.query(`UPSERT $id CONTENT $data;`, {
        id: memberId,
        data: memberData,
      });

      const updatedCtx = await getEffectiveAccessContext(event.request, db);
      return Response.json({
        success: true,
        data: {
          groupName,
          targetUsername: displayName,
          rights: effectiveRights,
          fullClaim,
          allGrants: updatedCtx.allGrants,
          activeGrants: updatedCtx.activeGrants,
        },
      });
    }

    // 3. REMOVE MEMBER FROM SPACE IN SURREALDB
    if (action === "remove_member") {
      const groupName = normalizeGroupName(body.groupName || "");
      const rawTarget = typeof body.targetUsername === "string" ? body.targetUsername.trim() : "";
      if (!groupName || !rawTarget) {
        return Response.json(
          { success: false, error: "Both groupName and targetUsername are required." },
          { status: 400 }
        );
      }

      if (!hasGroupRight(ctx, groupName, "manager") && !ctx.isAdmin) {
        return Response.json(
          {
            success: false,
            error: `You need "${groupName}:manager" permission to remove members from this space.`,
          },
          { status: 403 }
        );
      }

      const targetLower = rawTarget.toLowerCase();
      await db.query(
        `DELETE FROM group_member WHERE group = $group AND (string::lowercase(username ?? '') = $targetLower OR userSub = $rawTarget);`,
        {
          group: groupName,
          targetLower,
          rawTarget,
        }
      );

      const updatedCtx = await getEffectiveAccessContext(event.request, db);
      return Response.json({
        success: true,
        data: {
          groupName,
          targetUsername: rawTarget,
          allGrants: updatedCtx.allGrants,
          activeGrants: updatedCtx.activeGrants,
        },
      });
    }

    // 4. DELETE SPACE / GROUP FROM SURREALDB
    if (action === "delete_group") {
      const groupName = normalizeGroupName(body.groupName || "");
      if (!groupName) {
        return Response.json({ success: false, error: "Space name is required." }, { status: 400 });
      }

      if (!hasGroupRight(ctx, groupName, "manager") && !ctx.isAdmin) {
        return Response.json(
          {
            success: false,
            error: `You need "${groupName}:manager" permission to delete space "${groupName}".`,
          },
          { status: 403 }
        );
      }

      await db.query(`DELETE $id;`, { id: new RecordId("group_namespace", groupName) });
      await db.query(`DELETE FROM group_member WHERE group = $group;`, { group: groupName });

      const updatedCtx = await getEffectiveAccessContext(event.request, db);
      return Response.json({
        success: true,
        data: {
          deletedGroup: groupName,
          allGrants: updatedCtx.allGrants,
          activeGrants: updatedCtx.activeGrants,
        },
      });
    }

    return Response.json({ success: false, error: `Unknown action "${action}".` }, { status: 400 });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err?.message || "Space operation failed." },
      { status: 500 }
    );
  }
}
