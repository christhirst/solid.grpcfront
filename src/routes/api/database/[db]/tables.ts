import { APIEvent } from "solid-start/api";
import { getDynamicDb } from "~/lib/db";

export async function GET({ params }: APIEvent) {
  try {
    const dbName = params.db;
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid database name" }), { status: 400 });
    }

    const db = await getDynamicDb(dbName);
    
    // INFO FOR DATABASE returns an object with a 'tables' property map
    const info = await db.query("INFO FOR DATABASE;");
    const tablesObj = (info[0] as any)?.tables || {};
    
    // the keys of the tables object are the table names
    const tables = Object.keys(tablesObj);
    
    return new Response(JSON.stringify({ success: true, data: tables }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
