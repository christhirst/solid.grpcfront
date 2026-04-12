import { g as getDb, r as runWorkflowBackground } from "./db-BDuWXNK_.js";
import { RecordId } from "surrealdb";
import { v4 } from "uuid";
import "node-cron";
import "lodash.get";
import "./grpcExecutor-C8N6gsCz.js";
import "@grpc/grpc-js";
import "@grpc/proto-loader";
import "fs";
import "path";
import "os";
import "./protoParser-C1XlV9an.js";
import "protobufjs";
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
    if (!dashboard.isPublic) {
      return new Response(JSON.stringify({
        success: false,
        error: "Dashboard is not published"
      }), {
        status: 403,
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
    runWorkflowBackground(workflow, runId, {
      form: formPayload
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
//# sourceMappingURL=_buttonId_-C04GVEok.js.map
