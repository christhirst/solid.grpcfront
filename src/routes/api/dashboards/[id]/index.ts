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
import { canAccessResource, getResourcePermissions } from "~/lib/groupAuth";
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
    const hasTags = Array.isArray(record.tags) && record.tags.length > 0;

    if (ctx.sub === "anonymous") {
      if (record.isPublic !== true && (hasRealOwner || hasTags)) {
        return Response.json({ success: false, error: "Not found" }, { status: 404 });
      }
    } else if (!canAccessResource(ctx, record, "view") && record.isPublic !== true) {
      return Response.json(
        { success: false, error: "You do not have permission to view this dashboard." },
        { status: 403 }
      );
    }

    if (record) {
      record.id = `dashboard:${dbId}`;
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
        permissions: getResourcePermissions(ctx, record),
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
