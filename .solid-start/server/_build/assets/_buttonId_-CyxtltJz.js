import { g as getDb, r as runWorkflowBackground } from "./db-BycVvFuO.js";
import { RecordId } from "surrealdb";
import { v4 } from "uuid";
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
async function POST(event) {
  try {
    const dashboardId = event.params.id;
    const buttonId = event.params.buttonId;
    const db = await getDb();
    const dbId = dashboardId.includes(":") ? dashboardId.split(":")[1] : dashboardId;
    const dId = new RecordId("dashboard", dbId);
    const result = await db.select(dId);
    let records = Array.isArray(result) ? result : result ? [result] : [];
    const dashboard = records[0];
    if (!dashboard) {
      return new Response(JSON.stringify({
        success: false,
        error: "Dashboard not found"
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const buttons = dashboard.buttons || [];
    const button = buttons.find((b) => b.id === buttonId);
    if (!button) {
      return new Response(JSON.stringify({
        success: false,
        error: "Button not found on dashboard"
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (!button.workflowId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Button has no workflow assigned"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const wfDbId = button.workflowId.includes(":") ? button.workflowId.split(":")[1] : button.workflowId;
    const wfId = new RecordId("workflow", wfDbId);
    const wfResult = await db.select(wfId);
    const wfRecords = Array.isArray(wfResult) ? wfResult : wfResult ? [wfResult] : [];
    const workflow = wfRecords[0];
    if (!workflow) {
      return new Response(JSON.stringify({
        success: false,
        error: "Assigned workflow not found"
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    workflow.id = `workflow:${wfDbId}`;
    const runId = `run:${v4()}`;
    let formPayload = {};
    try {
      const body = await event.request.json();
      if (body && body.form) {
        formPayload = body.form;
      }
    } catch (e) {
    }
    if (button.formConfig && Array.isArray(button.formConfig)) {
      for (const fc of button.formConfig) {
        if (fc.name && (formPayload[fc.name] === void 0 || formPayload[fc.name] === "")) {
          const savedVal = fc.value ?? fc.defaultValue;
          if (savedVal !== void 0 && savedVal !== "") {
            formPayload[fc.name] = savedVal;
          }
        }
      }
    }
    const updatedButtons = buttons.map((candidate) => {
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
    runWorkflowBackground(workflow, runId, {
      form: formPayload,
      dashboard_form: formPayload
    }).catch((err) => {
      console.error(`Failed to run background workflow ${workflow.id} for run ${runId}`, err);
    });
    return new Response(JSON.stringify({
      success: true,
      runId
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
export {
  POST
};
//# sourceMappingURL=_buttonId_-CyxtltJz.js.map
