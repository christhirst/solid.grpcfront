import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();

    const dbId = id.includes(":") ? id.split(":")[1] : id;
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
  try {
    const id = event.params.id;
    const db = await getDb();
    const body = await new Response(event.request.body).json();
    
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    const recordId = `dashboard:${dbId}`;
    const dashboard = { ...body, id: recordId, updated_at: new Date().toISOString() };

    const { id: _, ...dataWithoutId } = dashboard;
    const sId = new RecordId("dashboard", dbId);
    const result = await db.query("UPDATE $id CONTENT $data", { id: sId, data: dataWithoutId });
    const records = Array.isArray(result) ? (result[0] || result) : result;
    const record = Array.isArray(records) ? records[0] : records;
    if (record) {
      record.id = `dashboard:${dbId}`;
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
    
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    const sId = new RecordId("dashboard", dbId);
    await db.delete(sId);
    
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
