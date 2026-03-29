import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    let protos: any = [];
    try {
      const result = await db.query("SELECT * FROM proto_file ORDER BY updated_at DESC");
      protos = (result[0] || []).map((p: any) => ({ ...p, id: p.id?.toString().replace(/[⟨⟩]/g, "") }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    return new Response(JSON.stringify({ success: true, data: protos }), {
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

    const rawId = body.id || `proto_file:${uuidv4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const protoDef = { ...body, id: rawId, updated_at: new Date().toISOString() };
    const { id: _, ...dataWithoutId } = protoDef;

    const recordId = new RecordId("proto_file", dbId);
    const result = await db.query("CREATE $id CONTENT $data", { 
      id: recordId, 
      data: dataWithoutId 
    });
    const record = Array.isArray(result) ? result[0] : result;
    if (record) record.id = `proto_file:${dbId}`;

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
