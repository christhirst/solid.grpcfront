import { g as getDb } from "./db-jfehURwc.js";
import "surrealdb";
import "@sentry/node";
import "node-cron";
import "./logger-BDLv3oYI.js";
import "lodash.get";
import "./grpcExecutor-C8N6gsCz.js";
import "@grpc/grpc-js";
import "@grpc/proto-loader";
import "fs";
import "path";
import "os";
import "./protoParser-C1XlV9an.js";
import "protobufjs";
import "uuid";
async function POST({
  request
}) {
  try {
    const {
      name
    } = await request.json();
    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({
        success: false,
        error: "Database name required"
      }), {
        status: 400
      });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid database name"
      }), {
        status: 400
      });
    }
    const db = await getDb();
    await db.query(`DEFINE DATABASE ${name};`);
    return new Response(JSON.stringify({
      success: true,
      data: {
        name
      }
    }), {
      headers: {
        "content-type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: {
        "content-type": "application/json"
      }
    });
  }
}
export {
  POST
};
//# sourceMappingURL=index-CzKXOucW.js.map
