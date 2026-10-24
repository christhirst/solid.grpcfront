import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";
import { scheduleWorkflow } from "~/lib/workflowScheduler";
import { getEffectiveAccessContext, getOwnerFromRequest } from "~/lib/auth";
import { canAccessResource, getResourcePermissions, normalizeGroupName } from "~/lib/groupAuth";
import { readJsonBody } from "~/lib/requestUtils";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const url = new URL(event.request.url);
    const q = url.searchParams.get("q")?.trim() || "";

    let workflows: any[] = [];
    try {
      let result;
      if (q) {
        result = await db.query(
          "SELECT * FROM workflow WHERE (string::lowercase(name) CONTAINS string::lowercase($q) OR $q INSIDE tags) ORDER BY updated_at DESC",
          { q }
        );
      } else {
        result = await db.query("SELECT * FROM workflow ORDER BY updated_at DESC");
      }
      const raw = ((result[0] as any[]) || []).map((w: any) => ({
        ...w,
        id: w.id?.toString().replace(/[⟨⟩]/g, ""),
      }));

      workflows = raw
        .filter((w: any) => {
          const hasRealOwner = Boolean(w.owner && w.owner !== "anonymous");
          const hasTags = Array.isArray(w.tags) && w.tags.length > 0;
          if (ctx.sub === "anonymous") {
            return !hasRealOwner && !hasTags;
          }
          return canAccessResource(ctx, w, "view");
        })
        .map((w: any) => ({
          ...w,
          tags: Array.isArray(w.tags) ? w.tags : [],
          permissions: getResourcePermissions(ctx, w),
        }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    return new Response(JSON.stringify({ success: true, data: workflows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(event: APIEvent) {
  try {
    const db = await getDb();
    const body = await readJsonBody(event);
    const owner = await getOwnerFromRequest(event.request);
    const ctx = await getEffectiveAccessContext(event.request, db);

    // Generate ID if not present
    const rawId = body.id || `workflow:${uuidv4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const now = new Date().toISOString();
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => normalizeGroupName(String(t).split(":")[0] || "")).filter(Boolean)
      : [];

    const workflow = {
      ...body,
      id: rawId,
      owner,
      tags,
      visibility: body.visibility || (tags.length > 0 ? "group" : "private"),
      created_at: body.created_at || now,
      updated_at: now,
    };

    const { id: _, permissions: _p, ...dataWithoutId } = workflow;
    const recordId = new RecordId("workflow", dbId);
    const result = await db.query("CREATE $id CONTENT $data", { id: recordId, data: dataWithoutId });
    const records = Array.isArray(result) ? result[0] || result : result;
    const record = Array.isArray(records) ? records[0] : records;
    if (record) {
      record.id = `workflow:${dbId}`;
      record.permissions = getResourcePermissions(ctx, record);
      // Schedule the workflow if it has a cron expression
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
