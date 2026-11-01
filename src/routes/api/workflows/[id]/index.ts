import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";
import { scheduleWorkflow, unscheduleWorkflow } from "~/lib/workflowScheduler";
import { getEffectiveAccessContext } from "~/lib/auth";
import {
  canAccessObject,
  getObjectPermissions,
  getTaggableGroups,
  mergeTagUpdate,
  normalizeTagList,
} from "~/lib/groupAuth";
import { canUseWorkflowViaDashboard } from "~/lib/dashboard/dashboardScope";
import { collectAllExistingGroups } from "~/routes/api/user/groups";
import { readJsonBody } from "~/lib/requestUtils";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const url = new URL(event.request.url);
    const dashboardIdParam = url.searchParams.get("dashboard") || "";

    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    let records: any = [];
    try {
      const recordId = new RecordId("workflow", dbId);
      const result = await db.select(recordId);
      records = Array.isArray(result) ? result : result ? [result] : [];
    } catch (e: any) {}

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = Array.isArray(records) ? records[0] : records;
    const directAllowed =
      ctx.capabilities.canManageWorkflows &&
      canAccessObject(ctx, record, "workflow", "view");
    const dashboardAllowed =
      !directAllowed &&
      Boolean(dashboardIdParam) &&
      (await canUseWorkflowViaDashboard(db, ctx, dashboardIdParam, dbId));

    if (!directAllowed && !dashboardAllowed) {
      return Response.json(
        {
          success: false,
          error: "You do not have permission to view this workflow.",
        },
        { status: 403 }
      );
    }

    if (record) {
      record.id = `workflow:${dbId}`;
      record.tags = normalizeTagList(record.tags);
      record.permissions = getObjectPermissions(ctx, record, "workflow");
    }
    return new Response(JSON.stringify({ success: true, data: record }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function PUT(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canManageWorkflows) {
      return Response.json(
        { success: false, error: "Creator or Admin role is required to modify workflows." },
        { status: 403 }
      );
    }
    const body = await readJsonBody(event);

    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const sId = new RecordId("workflow", dbId);
    const existingRes = await db.select(sId);
    const existing = Array.isArray(existingRes) ? existingRes[0] : existingRes;

    if (existing && !canAccessObject(ctx, existing, "workflow", "write")) {
      return Response.json(
        {
          success: false,
          error: "You do not have write permission to modify this workflow.",
        },
        { status: 403 }
      );
    }

    const recordId = `workflow:${dbId}`;
    // Tags are edited exclusively via the list tile checklist (PATCH); preserve existing tags here
    const tags = existing
      ? normalizeTagList(existing.tags)
      : normalizeTagList(body.tags);
    const owner =
      existing?.owner && existing.owner !== "anonymous"
        ? existing.owner
        : ctx.sub !== "anonymous"
          ? ctx.sub
          : existing?.owner || "anonymous";

    const { tags: _ignoredTags, ...bodyWithoutTags } = body || {};
    const workflow = {
      ...existing,
      ...bodyWithoutTags,
      id: recordId,
      owner,
      tags,
      updated_at: new Date().toISOString(),
    };

    const { id: _, permissions: _p, ...dataWithoutId } = workflow;
    const result = await db.query("UPDATE $id CONTENT $data", { id: sId, data: dataWithoutId });
    const records = Array.isArray(result) ? result[0] || result : result;
    const record = Array.isArray(records) ? records[0] : records;
    if (record) {
      record.id = `workflow:${dbId}`;
      record.permissions = getObjectPermissions(ctx, record, "workflow");
      scheduleWorkflow(record);
    }

    return new Response(JSON.stringify({ success: true, data: record }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function PATCH(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canManageWorkflows) {
      return Response.json(
        { success: false, error: "Creator or Admin role is required to tag workflows." },
        { status: 403 }
      );
    }
    const body = await readJsonBody(event);
    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const sId = new RecordId("workflow", dbId);
    const existingRes = await db.select(sId);
    const existing = Array.isArray(existingRes) ? existingRes[0] : existingRes;

    if (!existing) {
      return Response.json({ success: false, error: "Workflow not found." }, { status: 404 });
    }
    if (!canAccessObject(ctx, existing, "workflow", "write")) {
      return Response.json(
        { success: false, error: "You do not have permission to edit tags on this workflow." },
        { status: 403 }
      );
    }

    const allGroups = ctx.isAdmin ? await collectAllExistingGroups(db) : [];
    const allowed = getTaggableGroups(ctx, allGroups);
    const nextTags = mergeTagUpdate(existing.tags, body.tags, allowed);
    const now = new Date().toISOString();

    await db.query(`UPDATE $id MERGE { tags: $tags, updated_at: $now };`, {
      id: sId,
      tags: nextTags,
      now,
    });

    const updated = { ...existing, id: `workflow:${dbId}`, tags: nextTags, updated_at: now };
    return Response.json({
      success: true,
      data: {
        id: `workflow:${dbId}`,
        tags: nextTags,
        permissions: getObjectPermissions(ctx, updated, "workflow"),
      },
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canManageWorkflows) {
      return Response.json(
        { success: false, error: "Creator or Admin role is required to delete workflows." },
        { status: 403 }
      );
    }

    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const sId = new RecordId("workflow", dbId);
    const existingRes = await db.select(sId);
    const existing = Array.isArray(existingRes) ? existingRes[0] : existingRes;

    if (existing && !canAccessObject(ctx, existing, "workflow", "delete")) {
      return Response.json(
        {
          success: false,
          error: "You do not have delete permission for this workflow.",
        },
        { status: 403 }
      );
    }

    await db.delete(sId);
    unscheduleWorkflow(`workflow:${dbId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
