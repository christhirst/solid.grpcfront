import { APIEvent } from "@solidjs/start/server";
import { getDynamicDb } from "~/lib/db";
import { readJsonBody } from "~/lib/requestUtils";

export async function GET({ params, request }: APIEvent) {
  try {
    const dbName = params.db;
    const tableName = params.table;
    
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName) || !tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid database or table name" }), { status: 400 });
    }

    const url = new URL(request.url);
    const parsedLimit = Number.parseInt(url.searchParams.get("limit") || "500", 10);
    const parsedStart = Number.parseInt(url.searchParams.get("start") || "0", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(5000, Math.max(1, parsedLimit)) : 500;
    const start = Number.isFinite(parsedStart) ? Math.max(0, parsedStart) : 0;

    const db = await getDynamicDb(dbName);
    
    // Select paginated records from the table
    const records = await db.query(`SELECT * FROM ${tableName} LIMIT $limit START $start`, { limit, start });
    
    return new Response(JSON.stringify({ success: true, data: records }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST(event: APIEvent) {
  try {
    const dbName = event.params.db;
    const tableName = event.params.table;
    
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName) || !tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid database or table name" }), { status: 400 });
    }

    const { data } = await readJsonBody(event);
    if (!data || typeof data !== "object") {
      return new Response(JSON.stringify({ success: false, error: "Data object required" }), { status: 400 });
    }

    const db = await getDynamicDb(dbName);
    
    // Create new record in the table
    const result = await db.query(`CREATE ${tableName} CONTENT $data`, { data });

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
