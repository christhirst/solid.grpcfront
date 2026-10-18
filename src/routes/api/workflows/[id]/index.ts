import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";
import { scheduleWorkflow, unscheduleWorkflow } from "~/lib/workflowScheduler";
import { getEffectiveAccessContext } from "~/lib/auth";
import { canAccessResource, getResourcePermissions, normalizeGroupName } from "~/lib/groupAuth";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);

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
    if (record) {
      record.id = `workflow:${dbId}`;
      record.tags = Array.isArray(record.tags) ? record.tags : [];
      record.permissions = getResourcePermissions(ctx, record);
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
    const body = await new Response(event.request.body).json();

    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const sId = new RecordId("workflow", dbId);
    const existingRes = await db.select(sId);
    const existing = Array.isArray(existingRes) ? existingRes[0] : existingRes;

    if (existing) {
      const hasRealOwner = Boolean(existing.owner && existing.owner !== "anonymous");
      const hasTags = Array.isArray(existing.tags) && existing.tags.length > 0;
      if ((hasRealOwner || hasTags) && !canAccessResource(ctx, existing, "write")) {
        return Response.json(
          {
            success: false,
            error: "You do not have write permission to modify this workflow.",
          },
          { status: 403 }
        );
      }
    }

    const recordId = `workflow:${dbId}`;
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => normalizeGroupName(String(t).split(":")[0] || "")).filter(Boolean)
      : Array.isArray(existing?.tags)
        ? existing.tags
        : [];
    const owner =
      existing?.owner && existing.owner !== "anonymous"
        ? existing.owner
        : ctx.sub !== "anonymous"
          ? ctx.sub
          : existing?.owner || "anonymous";

    const workflow = {
      ...existing,
      ...body,
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
      record.permissions = getResourcePermissions(ctx, record);
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

export async function DELETE(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);

    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const sId = new RecordId("workflow", dbId);
    const existingRes = await db.select(sId);
    const existing = Array.isArray(existingRes) ? existingRes[0] : existingRes;

    if (existing) {
      const hasRealOwner = Boolean(existing.owner && existing.owner !== "anonymous");
      const hasTags = Array.isArray(existing.tags) && existing.tags.length > 0;
      if ((hasRealOwner || hasTags) && !canAccessResource(ctx, existing, "delete")) {
        return Response.json(
          {
            success: false,
            error: "You do not have delete permission for this workflow.",
          },
          { status: 403 }
        );
      }
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
