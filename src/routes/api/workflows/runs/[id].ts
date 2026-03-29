import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    
    // Check if it has a prefix, if not, add it
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    let records: any = [];
    try {
       const recordId = new RecordId("workflow_run", dbId);
       const result = await db.select(recordId);
       records = Array.isArray(result) ? result : (result ? [result] : []);
    } catch(e) {}

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Run not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = Array.isArray(records) ? records[0] : records;
    if (record) record.id = `workflow_run:${dbId}`;

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
