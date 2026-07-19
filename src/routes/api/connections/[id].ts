import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    const recordId = new RecordId("connection", dbId);
    
    const result = await db.select(recordId);
    const records = Array.isArray(result) ? result : (result ? [result] : []);
    const connection = records[0];

    if (!connection) {
      return new Response(JSON.stringify({ success: false, error: "Connection not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    connection.id = `connection:${dbId}`;
    return new Response(JSON.stringify({ success: true, data: connection }), {
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
    const recordId = new RecordId("connection", dbId);

    const connection = { ...body, updated_at: new Date().toISOString() };
    const { id: _, ...dataWithoutId } = connection;

    const result = await db.query("UPDATE $id CONTENT $data", { id: recordId, data: dataWithoutId });
    const records = Array.isArray(result) ? (result[0] || result) : result;
    const record = Array.isArray(records) ? records[0] : records;
    if (record) {
      record.id = `connection:${dbId}`;
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
    const recordId = new RecordId("connection", dbId);

    await db.delete(recordId);

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
