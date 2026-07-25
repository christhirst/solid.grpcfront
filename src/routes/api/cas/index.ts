import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";
import { getOwnerFromRequest } from "~/lib/auth";

export async function GET(_event: APIEvent) {
  try {
    const db = await getDb();
    let certs: any[] = [];
    try {
      const result = await db.query("SELECT * FROM ca_cert ORDER BY updated_at DESC");
      certs = (result[0] || []).map((c: any) => ({
        ...c,
        id: c.id?.toString().replace(/[⟨⟩]/g, ""),
      }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }
    return new Response(JSON.stringify({ success: true, data: certs }), {
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
    const owner = await getOwnerFromRequest(event.request);

    const rawId = body.id || `ca_cert:${uuidv4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const now = new Date().toISOString();

    const certDef = {
      ...body,
      id: rawId,
      owner,
      visibility: body.visibility || "public",
      created_at: body.created_at || now,
      updated_at: now,
    };
    const { id: _, ...dataWithoutId } = certDef;

    const recordId = new RecordId("ca_cert", dbId);
    const result = await db.query("CREATE $id CONTENT $data", {
      id: recordId,
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