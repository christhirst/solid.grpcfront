import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";
import { scheduleWorkflow } from "~/lib/workflowScheduler";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    let workflows: any = [];
    try {
      const result = await db.query("SELECT * FROM workflow ORDER BY updated_at DESC");
      workflows = ((result[0] as any[]) || []).map((w: any) => ({ ...w, id: w.id?.toString().replace(/[⟨⟩]/g, "") }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    return new Response(JSON.stringify({ success: true, data: workflows }), {
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
    const rawId = body.id || `workflow:${uuidv4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const workflow = { ...body, id: rawId, updated_at: new Date().toISOString() };

    const { id: _, ...dataWithoutId } = workflow;
    const recordId = new RecordId("workflow", dbId);
    const result = await db.query("CREATE $id CONTENT $data", { id: recordId, data: dataWithoutId });
    const records = Array.isArray(result) ? (result[0] || result) : result;
    const record = Array.isArray(records) ? records[0] : records;
    if (record) {
      record.id = `workflow:${dbId}`;
      // Schedule the workflow if it has a cron expression
      scheduleWorkflow(record);
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
