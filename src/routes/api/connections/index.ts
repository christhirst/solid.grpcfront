import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    let connections: any = [];
    try {
      const result = await db.query("SELECT * FROM connection ORDER BY updated_at DESC");
      connections = ((result[0] as any[]) || []).map((c: any) => ({ ...c, id: c.id?.toString().replace(/[⟨⟩]/g, "") }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    return new Response(JSON.stringify({ success: true, data: connections }), {
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
    const body = await new Response(event.request.body).json();

    // Generate ID if not present
    const rawId = body.id || `connection:${uuidv4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const connection = { ...body, id: rawId, updated_at: new Date().toISOString() };

    const { id: _, ...dataWithoutId } = connection;
    const recordId = new RecordId("connection", dbId);
    const result = await db.query("CREATE $id CONTENT $data", { id: recordId, data: dataWithoutId });
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
