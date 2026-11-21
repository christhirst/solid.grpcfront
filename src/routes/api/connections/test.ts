import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";
import {
  normalizeConnection,
  testHttpConnection,
  testGrpcConnection,
  testSurrealDbConnection,
  testS3Connection,
} from "~/lib/connections";
import { getEffectiveAccessContext } from "~/lib/auth";
import { canAccessResource } from "~/lib/groupAuth";
import { CONNECTION_SECRET_FIELDS } from "~/lib/vaultRef";
import { mergeMaskedConnectionSecrets } from "~/lib/crypto/envelope";

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    let config: any = mergeMaskedConnectionSecrets(body || {}, null, CONNECTION_SECRET_FIELDS);

    // Always resolve saved connection from DB when connectionId is supplied so masked `"********"` secrets restore cleanly
    if (body?.connectionId) {
      const db = await getDb();
      const ctx = await getEffectiveAccessContext(event.request, db);
      const rawId = String(body.connectionId);
      const dbId = (rawId.includes(":") ? rawId.split(":")[1] : rawId).replace(/[⟨⟩]/g, "").trim();
      const record = await db.select(new RecordId("connection", dbId));
      const conn = Array.isArray(record) ? record[0] : record;
      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: `Connection ${body.connectionId} not found` }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      const hasRealOwner = Boolean(conn.owner && conn.owner !== "anonymous");
      const hasTags = Array.isArray(conn.tags) && conn.tags.length > 0;
      if (
        ctx.sub === "anonymous"
          ? hasRealOwner || hasTags
          : !canAccessResource(ctx, conn, "view")
      ) {
        return Response.json(
          { success: false, error: "You do not have permission to test this connection." },
          { status: 403 }
        );
      }
      config = mergeMaskedConnectionSecrets({ ...conn, ...body }, conn, CONNECTION_SECRET_FIELDS);
    }

    const normalized = normalizeConnection(config);
    let result: any;

    if (normalized.type === "grpc") {
      result = await testGrpcConnection(normalized);
    } else if (normalized.type === "surrealdb") {
      result = await testSurrealDbConnection(normalized);
    } else if (normalized.type === "s3") {
      result = await testS3Connection(normalized);
    } else {
      // Default to HTTP
      result = await testHttpConnection(normalized);
    }

    if (result.success && body.connectionId && (normalized.authType === "oauth" || normalized.oauthProvider)) {
      try {
        const db = await getDb();
        const rawId = String(body.connectionId);
        const dbId = (rawId.includes(":") ? rawId.split(":")[1] : rawId).replace(/[⟨⟩]/g, "").trim();
        const verifiedAt = new Date().toISOString();
        await db.query("UPDATE $id MERGE $data", {
          id: new RecordId("connection", dbId),
          data: { oauthVerifiedAt: verifiedAt, oauthLastError: null, oauthProvider: true, updated_at: verifiedAt },
        });
        result.oauthVerifiedAt = verifiedAt;
      } catch {}
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
