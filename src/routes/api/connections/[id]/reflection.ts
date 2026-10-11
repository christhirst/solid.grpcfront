import type { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getDb } from "~/lib/db";
import { normalizeConnection, getCaCertContent, fetchPreRequestToken } from "~/lib/connections";
import { reflectGrpcServices } from "~/lib/grpcReflection";

export async function POST(event: APIEvent) {
  try {
    const rawParamId = event.params.id || "";
    const id = rawParamId.replace(/^connection:/, "").replace(/[⟨⟩]/g, "").trim();

    let body: any = null;
    try {
      body = await event.request.json();
    } catch {
      // Body is optional if connection already exists in DB
    }

    let rawConnection: any = null;
    if (id && id !== "adhoc" && id !== "draft" && id !== "new" && id !== "custom") {
      try {
        const db = await getDb();
        const result = await db.select(new RecordId("connection", id));
        const dbConn = Array.isArray(result) ? result[0] : result;
        if (dbConn) {
          rawConnection = { ...dbConn, ...(body || {}), type: "grpc" };
        }
      } catch {
        // Fallback to body below
      }
    }

    if (!rawConnection && body && (body.serverAddress || body.type === "grpc")) {
      rawConnection = { ...body, type: "grpc" };
    }

    if (!rawConnection) {
      return Response.json({ success: false, error: "Connection configuration not found" }, { status: 404 });
    }

    const connection = normalizeConnection(rawConnection);
    if (connection.type !== "grpc") {
      return Response.json({ success: false, error: "A gRPC connection is required" }, { status: 400 });
    }
    if (!connection.serverAddress) {
      return Response.json({ success: false, error: "Server address (host:port) is required" }, { status: 400 });
    }

    const metadata: Record<string, string> = {};
    try {
      const parsedMeta = typeof connection.metadata === "string" ? JSON.parse(connection.metadata || "{}") : (connection.metadata || {});
      for (const [key, value] of Object.entries(parsedMeta)) {
        metadata[key.toLowerCase()] = String(value);
      }
    } catch {
      // Ignore invalid metadata JSON
    }

    if (connection.authType === "basic" && (connection.username || connection.password)) {
      const basicToken = Buffer.from(`${connection.username || ""}:${connection.password || ""}`).toString("base64");
      metadata.authorization = `Basic ${basicToken}`;
    } else if (connection.authType === "bearer" && connection.bearerToken) {
      metadata.authorization = `Bearer ${connection.bearerToken}`;
    } else if (connection.authType === "oauth") {
      const token = await fetchPreRequestToken(connection);
      if (!token.success) throw new Error(token.error || "Failed to fetch OAuth token");
      metadata[(connection.tokenMetadataKey || "authorization").toLowerCase()] =
        `${connection.tokenHeaderPrefix ?? "Bearer "}${token.token}`;
    } else if (!metadata.authorization && connection.username && connection.password) {
      const basicToken = Buffer.from(`${connection.username}:${connection.password}`).toString("base64");
      metadata.authorization = `Basic ${basicToken}`;
    }

    const data = await reflectGrpcServices({
      serverAddress: connection.serverAddress,
      useTls: connection.useTls || !!connection.caId,
      caCert: await getCaCertContent(connection.caId),
      acceptInvalidCert: connection.acceptInvalidCert || connection.caId === "accept_all",
      metadata,
    });

    return Response.json({ success: true, data });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message || "Server reflection failed" }, { status: 502 });
  }
}
