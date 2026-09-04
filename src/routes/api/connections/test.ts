import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";
import {
  normalizeConnection,
  testHttpConnection,
  testGrpcConnection,
  testSurrealDbConnection,
} from "~/lib/connections";

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    let config = body;

    // If a connectionId was supplied instead of full params, fetch from DB
    if (body.connectionId && !body.url && !body.serverAddress) {
      const db = await getDb();
      const rawId = body.connectionId;
      const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
      const record = await db.select(new RecordId("connection", dbId));
      const conn = Array.isArray(record) ? record[0] : record;
      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: `Connection ${body.connectionId} not found` }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      config = { ...conn, ...body };
    }

    const normalized = normalizeConnection(config);
    let result: any;

    if (normalized.type === "grpc") {
      result = await testGrpcConnection(normalized);
    } else if (normalized.type === "surrealdb") {
      result = await testSurrealDbConnection(normalized);
    } else {
      // Default to HTTP
      result = await testHttpConnection(normalized);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Failed to execute connection test" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
