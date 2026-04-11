import { APIEvent } from "solid-start/api";
import { getDynamicDb } from "~/lib/db";

export async function POST({ request, params }: APIEvent) {
  try {
    const dbName = params.db;
    
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid database name" }), { status: 400 });
    }

    const { query } = await request.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Query string required" }), { status: 400 });
    }

    const db = await getDynamicDb(dbName);
    
    const result = await db.query(query);

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
