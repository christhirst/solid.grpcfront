import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";
import { getOwnerFromRequest } from "~/lib/auth";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    const url = new URL(event.request.url);
    const q = url.searchParams.get("q")?.trim() || "";

    let dashboards: any = [];
    try {
      let result;
      if (q) {
        result = await db.query(
          "SELECT * FROM dashboard WHERE string::lowercase(name) CONTAINS string::lowercase($q) ORDER BY updated_at DESC",
          { q }
        );
      } else {
        result = await db.query("SELECT * FROM dashboard ORDER BY updated_at DESC");
      }
      dashboards = ((result[0] as any[]) || []).map((w: any) => ({ ...w, id: w.id?.toString().replace(/[⟨⟩]/g, "") }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    try {
      const responseBody = JSON.stringify({ success: true, data: dashboards });
      return new Response(responseBody, {
        headers: { "Content-Type": "application/json" },
      });
    } catch (stringifyErr: any) {
      console.error("[API Dashboards] Stringification error:", stringifyErr);
      throw stringifyErr;
    }
  } catch (err: any) {
    console.error("[API Dashboards] General error:", err);
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

    const rawId = body.id || `dashboard:${uuidv4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const now = new Date().toISOString();
    const dashboard = {
      ...body,
      id: rawId,
      owner,
      visibility: body.visibility || "public",
      created_at: body.created_at || now,
      updated_at: now,
    };

    const { id: _, ...dataWithoutId } = dashboard;
    const recordId = new RecordId("dashboard", dbId);
    const result = await db.query("CREATE $id CONTENT $data", { id: recordId, data: dataWithoutId });
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
