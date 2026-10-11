import type { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getDb } from "~/lib/db";
import { normalizeConnection, getCaCertContent, fetchPreRequestToken } from "~/lib/connections";
import { reflectGrpcServices } from "~/lib/grpcReflection";

export async function POST(event: APIEvent) {
  try {
    const db = await getDb();
    const id = event.params.id.replace(/^connection:/, "");
    const result = await db.select(new RecordId("connection", id));
    const raw = Array.isArray(result) ? result[0] : result;
    if (!raw) return Response.json({ success: false, error: "Connection not found" }, { status: 404 });
    const connection = normalizeConnection(raw);
    if (connection.type !== "grpc") {
      return Response.json({ success: false, error: "A gRPC connection is required" }, { status: 400 });
    }
    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(JSON.parse(connection.metadata || "{}"))) {
      metadata[key.toLowerCase()] = String(value);
    }
    if (connection.authType === "bearer" && connection.bearerToken) {
      metadata.authorization = `Bearer ${connection.bearerToken}`;
    } else if (connection.authType === "oauth") {
      const token = await fetchPreRequestToken(connection);
      if (!token.success) throw new Error(token.error);
      metadata[(connection.tokenMetadataKey || "authorization").toLowerCase()] =
        `${connection.tokenHeaderPrefix ?? "Bearer "}${token.token}`;
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
