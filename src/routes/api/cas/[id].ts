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
      const recordId = new RecordId("ca_cert", dbId);
      const result = await db.query("SELECT * FROM $recordId", { recordId });
      records = result[0] || [];
    } catch (e: any) {}

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = Array.isArray(records) ? records[0] : records;
    if (record) record.id = `ca_cert:${dbId}`;

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
    const recordId = `ca_cert:${dbId}`;
    const certDef = { ...body, id: recordId, updated_at: new Date().toISOString() };
    const { id: _, ...dataWithoutId } = certDef;

    const sId = new RecordId("ca_cert", dbId);
    const result = await db.query("UPDATE $sId CONTENT $data", {
      sId,
      data: dataWithoutId,
    });
    const record = Array.isArray(result) ? result[0] : result;
    if (record) record.id = `ca_cert:${dbId}`;

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
    const sId = new RecordId("ca_cert", dbId);
    await db.query("DELETE $sId", { sId });

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