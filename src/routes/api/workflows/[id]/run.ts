import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { runWorkflowBackground } from "~/lib/workflowEngine";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";

export async function POST(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();

    // Get the workflow definition
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    let records: any = [];
    
    try {
      const recordId = new RecordId("workflow", dbId);
      const result = await db.select(recordId);
      records = Array.isArray(result) ? result : (result ? [result] : []);
    } catch (e) {
      records = []; // record doesn't exist
    }

    if (!records || records.length === 0 || !records[0]) {
      return new Response(JSON.stringify({ success: false, error: "Workflow not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const workflow = Array.isArray(records) ? records[0] : records;
    const runId = `workflow_run:${uuidv4()}`;

    // Read form data from payload if present
    let formPayload = {};
    try {
      const body = await event.request.json();
      if (body && body.form) {
        formPayload = body.form;
      }
    } catch (e) {
      // Ignored
    }

    // Kick off the background execution!
    runWorkflowBackground(workflow, runId, { form: formPayload }).catch(console.error);

    return new Response(JSON.stringify({ success: true, runId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const rawDbId = id.includes(":") ? id.split(":")[1] : id;
    const dbId = rawDbId.replace(/[⟨⟩]/g, "");
    const recordId = new RecordId("workflow", dbId);
    const wfIdStr = recordId.toString();
    const cleanWfIdStr = `workflow:${dbId}`;
    
    // Get all runs for this workflow matching RecordId, chevron string, or clean string
    const query = "SELECT * FROM workflow_run WHERE workflowId = $wfId OR workflowId = $wfIdStr OR workflowId = $cleanWfIdStr OR workflowId = $dbId ORDER BY startTime DESC LIMIT 20";
    let results: any = [[]];
    try {
      const raw: any = await db.query(query, { wfId: recordId, wfIdStr, cleanWfIdStr, dbId });
      results = [ (raw[0] || []).map((r: any) => ({ ...r, id: r.id?.toString().replace(/[⟨⟩]/g, "") })) ];
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    return new Response(JSON.stringify({ success: true, data: results[0] }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
