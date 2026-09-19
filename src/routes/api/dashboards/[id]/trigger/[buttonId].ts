import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { runWorkflowBackground } from "~/lib/workflowEngine";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";
import {
  DashboardRecord,
  TriggerPayload,
  findButton,
  mergeFormPayload,
  normalizeId,
  buildUpdatedButtons,
} from "~/lib/dashboard/triggerHelpers";

function jsonResponse(payload: { success: boolean; error?: string; runId?: string }, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(event: APIEvent) {
  const dashboardId = event.params.id;
  const buttonId = event.params.buttonId;

  const db = await getDb();
  const dbId = normalizeId(dashboardId);
  const dId = new RecordId("dashboard", dbId);

  const result = await db.select(dId);
  const records = Array.isArray(result) ? result : result ? [result] : [];
  const dashboard = records[0] as DashboardRecord | undefined;

  if (!dashboard) {
    return jsonResponse({ success: false, error: "Dashboard not found" }, 404);
  }

  const button = findButton(dashboard, buttonId);
  if (!button) {
    return jsonResponse({ success: false, error: "Button not found on dashboard" }, 404);
  }

  const targetWorkflowId = (button as any).workflowId;
  if (!targetWorkflowId) {
    return jsonResponse({ success: false, error: "Button has no workflow assigned" }, 400);
  }

  let body: TriggerPayload = {};
  try {
    const raw = await event.request.json();
    if (raw && typeof raw === "object") body = raw as TriggerPayload;
  } catch {
    // No body or invalid JSON; use defaults.
  }

  // Allow the request to override the workflow that gets executed. The default
  // remains the workflow stored on the widget so existing behaviour is preserved.
  const workflowIdToRun = body.workflowId ?? targetWorkflowId;

  const wfDbId = normalizeId(workflowIdToRun as string);
  const wfId = new RecordId("workflow", wfDbId);
  const wfResult = await db.select(wfId);
  const wfRecords = Array.isArray(wfResult) ? wfResult : wfResult ? [wfResult] : [];
  const workflow = wfRecords[0];

  if (!workflow) {
    return jsonResponse({ success: false, error: "Assigned workflow not found" }, 404);
  }

  (workflow as any).id = `workflow:${wfDbId}`;

  const formPayload = mergeFormPayload(body.form ?? {}, button.formConfig);
  const updatedButtons = buildUpdatedButtons(dashboard.buttons, buttonId, formPayload);
  const { id: _dashboardId, ...dashboardData } = dashboard;

  await db.query("UPDATE $id CONTENT $data", {
    id: dId,
    data: {
      ...dashboardData,
      buttons: updatedButtons,
      updated_at: new Date().toISOString(),
    },
  });

  const runId = `run:${uuidv4()}`;
  runWorkflowBackground(workflow, runId, { form: formPayload, dashboard_form: formPayload }).catch((err) => {
    console.error(`Failed to run background workflow ${(workflow as any).id} for run ${runId}`, err);
  });

  return jsonResponse({ success: true, runId });
}
