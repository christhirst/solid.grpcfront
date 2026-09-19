import { g as getDb, r as runWorkflowBackground } from "./db-YKr91eu6.js";
import { v4 } from "uuid";
import { RecordId } from "surrealdb";
import "@sentry/node";
import "node-cron";
import "./logger-BDLv3oYI.js";
import "jsonata";
import "lodash.get";
import "./grpcExecutor-DlteWgV8.js";
import "@grpc/grpc-js";
import "@grpc/proto-loader";
import "fs";
import "path";
import "os";
import "./httpExecutor-C7gv4kID.js";
import "./protoParser-C1XlV9an.js";
import "protobufjs";
import "events";
import "./connections-DgOrSVbb.js";
function normalizeId(id) {
  return id.includes(":") ? id.split(":")[1] : id;
}
function findButton(dashboard, buttonId) {
  return (dashboard.buttons || []).find((b) => b.id === buttonId);
}
function mergeFormPayload(submitted, formConfig) {
  const merged = {
    ...submitted
  };
  if (!Array.isArray(formConfig)) return merged;
  for (const field of formConfig) {
    if (!field.name) continue;
    if (merged[field.name] !== void 0 && merged[field.name] !== "") continue;
    const savedVal = field.value ?? field.defaultValue;
    if (savedVal !== void 0 && savedVal !== "") {
      merged[field.name] = savedVal;
    }
  }
  return merged;
}
function buildUpdatedButtons(buttons, buttonId, formPayload) {
  return buttons.map((candidate) => {
    if (candidate.id !== buttonId) return candidate;
    return {
      ...candidate,
      lastFormPayload: formPayload,
      formConfig: Array.isArray(candidate.formConfig) ? candidate.formConfig.map((field) => field.name && Object.prototype.hasOwnProperty.call(formPayload, field.name) ? {
        ...field,
        value: formPayload[field.name]
      } : field) : candidate.formConfig
    };
  });
}
function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
async function POST(event) {
  const dashboardId = event.params.id;
  const buttonId = event.params.buttonId;
  const db = await getDb();
  const dbId = normalizeId(dashboardId);
  const dId = new RecordId("dashboard", dbId);
  const result = await db.select(dId);
  const records = Array.isArray(result) ? result : result ? [result] : [];
  const dashboard = records[0];
  if (!dashboard) {
    return jsonResponse({
      success: false,
      error: "Dashboard not found"
    }, 404);
  }
  const button = findButton(dashboard, buttonId);
  if (!button) {
    return jsonResponse({
      success: false,
      error: "Button not found on dashboard"
    }, 404);
  }
  const targetWorkflowId = button.workflowId;
  if (!targetWorkflowId) {
    return jsonResponse({
      success: false,
      error: "Button has no workflow assigned"
    }, 400);
  }
  let body = {};
  try {
    const raw = await event.request.json();
    if (raw && typeof raw === "object") body = raw;
  } catch {
  }
  const workflowIdToRun = body.workflowId ?? targetWorkflowId;
  const wfDbId = normalizeId(workflowIdToRun);
  const wfId = new RecordId("workflow", wfDbId);
  const wfResult = await db.select(wfId);
  const wfRecords = Array.isArray(wfResult) ? wfResult : wfResult ? [wfResult] : [];
  const workflow = wfRecords[0];
  if (!workflow) {
    return jsonResponse({
      success: false,
      error: "Assigned workflow not found"
    }, 404);
  }
  workflow.id = `workflow:${wfDbId}`;
  const formPayload = mergeFormPayload(body.form ?? {}, button.formConfig);
  const updatedButtons = buildUpdatedButtons(dashboard.buttons, buttonId, formPayload);
  const {
    id: _dashboardId,
    ...dashboardData
  } = dashboard;
  await db.query("UPDATE $id CONTENT $data", {
    id: dId,
    data: {
      ...dashboardData,
      buttons: updatedButtons,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  const runId = `run:${v4()}`;
  runWorkflowBackground(workflow, runId, {
    form: formPayload,
    dashboard_form: formPayload
  }).catch((err) => {
    console.error(`Failed to run background workflow ${workflow.id} for run ${runId}`, err);
  });
  return jsonResponse({
    success: true,
    runId
  });
}
export {
  POST
};
//# sourceMappingURL=_buttonId_-CebjK7BA.js.map
