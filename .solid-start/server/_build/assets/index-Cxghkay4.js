import { g as getDb, s as scheduleWorkflow } from "./db-BDuWXNK_.js";
import { v4 } from "uuid";
import { RecordId } from "surrealdb";
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
    const db = await getDb();
    const body = await new Response(event.request.body).json();
    const rawId = body.id || `workflow:${v4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const workflow = {
      ...body,
      id: rawId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const {
      id: _,
      ...dataWithoutId
    } = workflow;
    const recordId = new RecordId("workflow", dbId);
    const result = await db.query("CREATE $id CONTENT $data", {
      id: recordId,
      data: dataWithoutId
    });
    const records = Array.isArray(result) ? result[0] || result : result;
    const record = Array.isArray(records) ? records[0] : records;
    if (record) {
      record.id = `workflow:${dbId}`;
      scheduleWorkflow(record);
    }
    return new Response(JSON.stringify({
      success: true,
      data: record
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
//# sourceMappingURL=index-Cxghkay4.js.map
