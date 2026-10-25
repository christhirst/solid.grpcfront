import type { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { v4 as uuidv4 } from "uuid";
import { getAuthUser, getEffectiveAccessContext } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { ensurePublishingSchema } from "~/lib/dashboard/publishing";
import {
  canAccessResource,
  canCreateGroupNamespace,
  formatGroupClaim,
  groupCoversTag,
  hasGroupRight,
  normalizeGroupName,
} from "~/lib/groupAuth";
import { readJsonBody } from "~/lib/requestUtils";
import { runWorkflowBackground } from "~/lib/workflowEngine";

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

  // 2. Resource tags across tables
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

    let records: any[] = [];
    try {
      const res = await db.query("SELECT * FROM group_namespace ORDER BY name ASC;");
      records = Array.isArray(res?.[0]) ? res[0] : [];
    } catch {
      records = [];
    }

    const visibleGroups = records
      .filter((g) => {
        if (ctx.isAdmin) return true;
        if (g.owner === user.sub && !ctx.disableOwnerBypass) return true;
        const normName = normalizeGroupName(g.name || "");
        return ctx.activeGrants.some(
          (grant) => groupCoversTag(grant.group, normName) || groupCoversTag(normName, grant.group)
        );
      })
      .map((g) => ({
        ...g,
        id: g.id?.toString().replace(/[⟨⟩]/g, ""),
        canManage: hasGroupRight(ctx, g.name, "manager"),
        canUse: hasGroupRight(ctx, g.name, "use"),
      }));

    return Response.json({
      success: true,
      data: {
        groups: visibleGroups,
        existingGroupNames: [...existingSet].sort(),
      },
    });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err?.message || "Failed to load groups." },
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

    if (action === "create") {
      const existingSet = await collectAllExistingGroups(db);
      const validation = canCreateGroupNamespace(ctx, body.groupName || "", existingSet);
      if (!validation.allowed) {
        return Response.json(
          { success: false, error: validation.error || "Cannot create group." },
          { status: 403 }
        );
      }

      const now = new Date().toISOString();
      const groupName = validation.normalized;
      const recordId = new RecordId("group_namespace", groupName);
      const workflowId = typeof body.workflowId === "string" && body.workflowId.trim() ? body.workflowId.trim() : undefined;

      const groupRecord = {
        name: groupName,
        parent: validation.parent,
        owner: user.sub,
        description: typeof body.description === "string" ? body.description.trim() : "",
        onCreateWorkflowId: workflowId,
        memberAssignWorkflowId: workflowId,
        created_at: now,
        updated_at: now,
      };

      await db.query(`CREATE $id CONTENT $data;`, {
        id: recordId,
        data: groupRecord,
      });

      // Grant temporary session manager right (groupName:manager) for this login session
      const profileId = new RecordId("user_profile", user.sub);
      const existingProfileRes = await db.select(profileId);
      const existingProfile = Array.isArray(existingProfileRes) ? existingProfileRes[0] : existingProfileRes;
      const prevSessionGrants = Array.isArray(existingProfile?.sessionGrants)
        ? existingProfile.sessionGrants
        : [];
      const newGrant = {
        claim: `${groupName}:manager`,
        sessionId: user.sessionId || "default",
        created_at: now,
      };

      await db.query(
        `UPSERT $profile MERGE { sessionGrants: $sessionGrants, updated_at: $now };`,
        {
          profile: profileId,
          sessionGrants: [...prevSessionGrants, newGrant],
          now,
        }
      );

      // Optionally trigger an IdP management workflow (e.g. "Create Group in Keycloak")
      let triggeredRunId: string | undefined;
      if (workflowId) {
        const wfDbId = (workflowId.includes(":") ? workflowId.split(":")[1] : workflowId)
          .replace(/[⟨⟩]/g, "")
          .trim();
        const wfRes = await db.select(new RecordId("workflow", wfDbId));
        const wf = Array.isArray(wfRes) ? wfRes[0] : wfRes;
        if (wf) {
          wf.id = `workflow:${wfDbId}`;
          const updatedCtx = await getEffectiveAccessContext(event.request, db);
          if (canAccessResource(updatedCtx, wf, "use")) {
            triggeredRunId = `workflow_run:${uuidv4()}`;
            const formPayload = {
              action: "create_group",
              groupName,
              parentGroup: validation.parent || "",
              leafName: validation.leaf,
              creatorSub: user.sub,
              creatorUsername: user.username || user.name || user.sub,
              creatorEmail: user.email || "",
              role: "manager",
              rights: "manager",
              fullClaim: `${groupName}:manager`,
            };
            runWorkflowBackground(wf, triggeredRunId, {
              form: formPayload,
              dashboard_form: formPayload,
            }).catch((err) => {
              console.error(`[Groups API] Failed to run onCreate workflow ${wf.id}:`, err);
            });
          }
        }
      }

      const updatedCtx = await getEffectiveAccessContext(event.request, db);
      return Response.json({
        success: true,
        data: {
          group: groupRecord,
          sessionClaim: `${groupName}:manager`,
          runId: triggeredRunId,
          allGrants: updatedCtx.allGrants,
          activeGrants: updatedCtx.activeGrants,
        },
      });
    }

    if (action === "assign_member") {
      const groupName = normalizeGroupName(body.groupName || "");
      if (!groupName) {
        return Response.json({ success: false, error: "Group name is required." }, { status: 400 });
      }
      // User must have at least "use" or "manager" on the group
      if (!hasGroupRight(ctx, groupName, "manager") && !hasGroupRight(ctx, groupName, "use")) {
        return Response.json(
          {
            success: false,
            error: `You need "${groupName}:manager" or "${groupName}:use" permission to assign roles for this group.`,
          },
          { status: 403 }
        );
      }

      const targetUsername = typeof body.targetUsername === "string" ? body.targetUsername.trim() : "";
      if (!targetUsername) {
        return Response.json(
          { success: false, error: "Exact target username is required." },
          { status: 400 }
        );
      }

      const rightsInput = body.rights || "use";
      const fullClaim = formatGroupClaim(groupName, rightsInput);
      const workflowId = typeof body.workflowId === "string" ? body.workflowId.trim() : "";
      if (!workflowId) {
        return Response.json(
          { success: false, error: "Select an IdP management workflow to execute." },
          { status: 400 }
        );
      }

      const wfDbId = (workflowId.includes(":") ? workflowId.split(":")[1] : workflowId)
        .replace(/[⟨⟩]/g, "")
        .trim();
      const wfRes = await db.select(new RecordId("workflow", wfDbId));
      const wf = Array.isArray(wfRes) ? wfRes[0] : wfRes;
      if (!wf) {
        return Response.json({ success: false, error: "Selected workflow not found." }, { status: 404 });
      }
      wf.id = `workflow:${wfDbId}`;

      if (!canAccessResource(ctx, wf, "use")) {
        return Response.json(
          { success: false, error: "You do not have permission to execute this workflow." },
          { status: 403 }
        );
      }

      const runId = `workflow_run:${uuidv4()}`;
      const rightsStr = Array.isArray(rightsInput) ? rightsInput.join(",") : String(rightsInput);
      const formPayload = {
        action: "assign_member",
        groupName,
        targetUsername,
        rights: rightsStr,
        fullClaim,
        actorSub: user.sub,
        actorUsername: user.username || user.name || user.sub,
      };

      runWorkflowBackground(wf, runId, {
        form: formPayload,
        dashboard_form: formPayload,
      }).catch((err) => {
        console.error(`[Groups API] Failed to run assign_member workflow ${wf.id}:`, err);
      });

      return Response.json({
        success: true,
        data: {
          runId,
          groupName,
          targetUsername,
          fullClaim,
        },
      });
    }

    return Response.json({ success: false, error: `Unknown action "${action}".` }, { status: 400 });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err?.message || "Group operation failed." },
      { status: 500 }
    );
  }
}
