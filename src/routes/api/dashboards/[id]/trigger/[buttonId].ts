import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { runWorkflowBackground } from "~/lib/workflowEngine";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";
import {
  DashboardButton,
  DashboardRecord,
  TriggerPayload,
  findButton,
  mergeFormPayload,
  normalizeId,
  buildUpdatedButtons,
  allowedWorkflowIds,
} from "~/lib/dashboard/triggerHelpers";
import { readJsonBody } from "~/lib/requestUtils";
import { buildWorkflowUserContext } from "~/lib/auth";
import { validateWorkflowFormPayload } from "~/lib/formValidator";
import { collectVisitedSurveyFields } from "~/lib/dashboard/surveyEngine";

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

  let body: TriggerPayload = {};
  try {
    const raw = await readJsonBody(event);
    if (raw && typeof raw === "object") body = raw as TriggerPayload;
  } catch {
    // No body or invalid JSON; use defaults.
  }

  // Allow the request to override the workflow that gets executed if authorized. The default
  // remains the workflow stored on the widget so existing behaviour is preserved. Surveys may
  // have no top-level workflow at all and rely on per-step workflows supplied by the request.
  const workflowIdToRun = body.workflowId || (button as any).workflowId;
  if (!workflowIdToRun) {
    return jsonResponse({ success: false, error: "Button has no workflow assigned" }, 400);
  }
  const allowed = allowedWorkflowIds(button);
  if (!allowed.has(normalizeId(workflowIdToRun as string))) {
    return jsonResponse({ success: false, error: "Workflow not permitted for this widget" }, 403);
  }

  const wfDbId = normalizeId(workflowIdToRun as string);
  const wfId = new RecordId("workflow", wfDbId);
  const wfResult = await db.select(wfId);
  const wfRecords = Array.isArray(wfResult) ? wfResult : wfResult ? [wfResult] : [];
  const workflow = wfRecords[0];

  if (!workflow) {
    return jsonResponse({ success: false, error: "Assigned workflow not found" }, 404);
  }

  (workflow as any).id = `workflow:${wfDbId}`;

  const isSurvey = (button as any).widgetType === "survey";
  let activeFormConfig: DashboardButton["formConfig"] = button.formConfig;
  if (isSurvey) {
    const steps = (button as any).surveyConfig?.steps || [];
    const stepFields = body.surveyStepId
      ? steps.find((s: any) => s.id === body.surveyStepId)?.fields
      : undefined;
    activeFormConfig = (stepFields || collectVisitedSurveyFields(steps, body.form ?? {})) as any;
  }

  const formPayload = mergeFormPayload(body.form ?? {}, activeFormConfig);
  const validation = validateWorkflowFormPayload(workflow, activeFormConfig as any, formPayload);
  if (!validation.valid) {
    return jsonResponse(
      {
        success: false,
        error: validation.firstError || "Form validation failed",
      },
      400
    );
  }

  // Skip updating dashboard buttons for auxiliary series runs, surveys, and ephemeral/sequential
  // submissions so one respondent's answers are never saved into the shared dashboard definition.
  const skipPersist =
    body.seriesRun === true ||
    body.ephemeral === true ||
    isSurvey ||
    Boolean((button as any).sequenceConfig?.hideOnSubmit);
  if (!skipPersist) {
    const updatedButtons = buildUpdatedButtons(dashboard.buttons, buttonId, formPayload);

    await db.query("UPDATE $id MERGE $data", {
      id: dId,
      data: {
        buttons: updatedButtons,
        updated_at: new Date().toISOString(),
      },
    });
  }

  const runId = `run:${uuidv4()}`;
  const $user = await buildWorkflowUserContext(event.request, db);
  runWorkflowBackground(workflow, runId, { form: formPayload, dashboard_form: formPayload, $user }).catch((err) => {
    console.error(`Failed to run background workflow ${(workflow as any).id} for run ${runId}`, err);
  });

  return jsonResponse({ success: true, runId });
}
