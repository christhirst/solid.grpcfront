import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";
import { runWorkflowBackground } from "~/lib/workflowEngine";
import { v4 as uuidv4 } from "uuid";

export async function POST(event: APIEvent) {
  try {
    const dashboardId = event.params.id;
    const buttonId = event.params.buttonId;
    const db = await getDb();

    const dbId = dashboardId.includes(":") ? dashboardId.split(":")[1] : dashboardId;
    const dId = new RecordId("dashboard", dbId);
    const result = await db.select(dId);
    let records = Array.isArray(result) ? result : (result ? [result] : []);
    const dashboard = records[0];

    if (!dashboard) {
      return new Response(JSON.stringify({ success: false, error: "Dashboard not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!dashboard.isPublic) {
      return new Response(JSON.stringify({ success: false, error: "Dashboard is not published" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find the button
    const buttons = dashboard.buttons || [];
    const button = buttons.find((b: any) => b.id === buttonId);

    if (!button) {
      return new Response(JSON.stringify({ success: false, error: "Button not found on dashboard" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!button.workflowId) {
      return new Response(JSON.stringify({ success: false, error: "Button has no workflow assigned" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Now look up the workflow
    const wfDbId = button.workflowId.includes(":") ? button.workflowId.split(":")[1] : button.workflowId;
    const wfId = new RecordId("workflow", wfDbId);
    const wfResult = await db.select(wfId);
    const wfRecords = Array.isArray(wfResult) ? wfResult : (wfResult ? [wfResult] : []);
    const workflow = wfRecords[0];

    if (!workflow) {
      return new Response(JSON.stringify({ success: false, error: "Assigned workflow not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    workflow.id = `workflow:${wfDbId}`; // Normalize ID format for engine
    
    // Generate a run ID
    const runId = `run:${uuidv4()}`;

    // Start background execution
    // Do not await this, we just trigger it and return the ID.
    runWorkflowBackground(workflow, runId).catch(err => {
      console.error(`Failed to run background workflow ${workflow.id} for run ${runId}`, err);
    });

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
