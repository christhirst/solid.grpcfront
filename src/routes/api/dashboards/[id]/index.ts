import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";
import { getAuthUser, getEffectiveAccessContext } from "~/lib/auth";
import {
  saveDashboard,
  assertDashboardOwner,
  firstRecord,
  publishingErrorResponse,
} from "~/lib/dashboard/publishing";
import {
  canAccessObject,
  getObjectPermissions,
  getTaggableGroups,
  mergeTagUpdate,
  normalizeTagList,
} from "~/lib/groupAuth";
import { collectAllExistingGroups } from "~/lib/groups";
import { readJsonBody } from "~/lib/requestUtils";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);

    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    let records: any = [];
    try {
      const recordId = new RecordId("dashboard", dbId);
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
    const hasRealOwner = Boolean(record.owner && record.owner !== "anonymous");
    const tags = normalizeTagList(record.tags);

    if (ctx.sub === "anonymous") {
      if (record.isPublic !== true && (hasRealOwner || tags.length > 0)) {
        return Response.json({ success: false, error: "Not found" }, { status: 404 });
      }
    } else if (!canAccessObject(ctx, record, "dashboard", "view") && record.isPublic !== true) {
      return Response.json(
        { success: false, error: "You do not have permission to view this dashboard." },
        { status: 403 }
      );
    }

    if (record) {
      record.id = `dashboard:${dbId}`;
      record.tags = tags;
      record.content_tags = Array.isArray(record.content_tags)
        ? record.content_tags
            .map((t: any) => String(t || "").trim())
            .filter(Boolean)
        : [];
      record.permissions = getObjectPermissions(ctx, record, "dashboard");
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
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canEditDashboards) {
      return Response.json(
        { success: false, error: "Your platform role (viewer) can only use the Library and cannot modify dashboards." },
        { status: 403 }
      );
    }
    const body = await readJsonBody(event);
    const record = await saveDashboard(db, user.sub, event.params.id, body, false, ctx);
    return Response.json({
      success: true,
      data: {
        ...record,
        permissions: getObjectPermissions(ctx, record, "dashboard"),
      },
    });
  } catch (err) {
    return publishingErrorResponse(err);
  }
}

export async function PATCH(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canEditDashboards) {
      return Response.json(
        { success: false, error: "Your platform role (viewer) cannot tag dashboards." },
        { status: 403 }
      );
    }
    const body = await readJsonBody(event);
    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const sId = new RecordId("dashboard", dbId);
    const existing = firstRecord(await db.select(sId));
    if (!existing) {
      return Response.json({ success: false, error: "Dashboard not found." }, { status: 404 });
    }
    assertDashboardOwner(existing, user.sub, "write", ctx);

    const allGroups = ctx.isAdmin ? await collectAllExistingGroups(db) : [];
    const allowed = getTaggableGroups(ctx, allGroups);
    const nextTags = mergeTagUpdate(existing.tags, body.tags, allowed);
    const now = new Date().toISOString();

    await db.query(`UPDATE $id MERGE { tags: $tags, updated_at: $now };`, {
      id: sId,
      tags: nextTags,
      now,
    });

    const updated = { ...existing, id: `dashboard:${dbId}`, tags: nextTags, updated_at: now };
    return Response.json({
      success: true,
      data: {
        id: `dashboard:${dbId}`,
        tags: nextTags,
        permissions: getObjectPermissions(ctx, updated, "dashboard"),
      },
    });
  } catch (err) {
    return publishingErrorResponse(err);
  }
}

export async function DELETE(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canEditDashboards) {
      return Response.json(
        { success: false, error: "Your platform role (viewer) can only use the Library and cannot delete dashboards." },
        { status: 403 }
      );
    }

    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const sId = new RecordId("dashboard", dbId);
    const existing = firstRecord(await db.select(sId));
    if (!existing) {
      return Response.json({ success: false, error: "Dashboard not found." }, { status: 404 });
    }
    assertDashboardOwner(existing, user.sub, "delete", ctx);
    await db.delete(sId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return publishingErrorResponse(err);
  }
}
