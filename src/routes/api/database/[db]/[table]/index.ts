import { APIEvent } from "solid-start/api";
import { getDynamicDb } from "~/lib/db";

export async function GET({ params }: APIEvent) {
  try {
    const dbName = params.db;
    const tableName = params.table;
    
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName) || !tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid database or table name" }), { status: 400 });
    }

    const db = await getDynamicDb(dbName);
    
    // Select all records from the table
    const records = await db.query(`SELECT * FROM ${tableName}`);
    
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

export async function POST({ request, params }: APIEvent) {
  try {
    const dbName = params.db;
    const tableName = params.table;
    
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName) || !tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid database or table name" }), { status: 400 });
    }

    const { data } = await request.json();
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
