import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";
import { getAuthUser } from "~/lib/auth";
import { saveDashboard, assertDashboardOwner, firstRecord, publishingErrorResponse } from "~/lib/dashboard/publishing";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();

    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    let records: any = [];
    try {
      const recordId = new RecordId("dashboard", dbId);
      const result = await db.select(recordId);
      records = Array.isArray(result) ? result : (result ? [result] : []);
    } catch (e: any) {}

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = Array.isArray(records) ? records[0] : records;
    if (record.isPublic !== true && !(await getAuthUser(event.request))) {
      return Response.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (record) record.id = `dashboard:${dbId}`;
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
  if (!user || user.sub === "anonymous") return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  try {
    const db = await getDb();
    const body = await event.request.json();
    const record = await saveDashboard(db, user.sub, event.params.id, body);
    return Response.json({ success: true, data: record });
  } catch (err) {
    return publishingErrorResponse(err);
  }
}

export async function DELETE(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  try {
    const id = event.params.id;
    const db = await getDb();
    
    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const sId = new RecordId("dashboard", dbId);
    assertDashboardOwner(firstRecord(await db.select(sId)), user.sub);
    await db.delete(sId);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return publishingErrorResponse(err);
  }
}
