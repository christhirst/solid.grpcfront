import { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getDb } from "~/lib/db";
import { fetchPreRequestToken, normalizeConnection } from "~/lib/connections";
import { getEffectiveAccessContext } from "~/lib/auth";
import { canAccessResource } from "~/lib/groupAuth";

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    let config: any = body;
    let targetDbId: string | undefined;
    let canEditTarget = false;
    let db: any;

    if (body.connectionId) {
      db = await getDb();
      const ctx = await getEffectiveAccessContext(event.request, db);
      const rawId = String(body.connectionId);
      const dbId = (rawId.includes(":") ? rawId.split(":")[1] : rawId).replace(/[⟨⟩]/g, "").trim();
      const record = await db.select(new RecordId("connection", dbId));
      const connRecord = Array.isArray(record) ? record[0] : record;
      if (!connRecord) {
        return new Response(
          JSON.stringify({ success: false, error: `Connection ${body.connectionId} not found` }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      const normalized = normalizeConnection(connRecord) as any;
      canEditTarget = ctx.sub === "anonymous" || canAccessResource(ctx, normalized, "edit");
      targetDbId = dbId;
      config = { ...normalized, ...body };

      // If this connection uses static bearer auth instead of dynamic OAuth pre-request
      if (normalized.authType === "bearer" && normalized.bearerToken && !normalized.tokenUrl && !body.tokenUrl && !body.url) {
        return new Response(
          JSON.stringify({
            success: true,
            token: normalized.bearerToken,
            tokenPath: "bearerToken",
            headerName: normalized.tokenHeaderName || "Authorization",
            headerPrefix: normalized.tokenHeaderPrefix ?? "Bearer ",
            connectionName: normalized.name,
            latencyMs: 0,
            oauthVerifiedAt: normalized.oauthVerifiedAt,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const tokenUrl = config.tokenUrl || config.url;
    const tokenMethod = config.tokenMethod || config.method || "POST";
    const tokenAuthScheme = config.tokenAuthScheme || config.authScheme || "none";
    const tokenUsername = config.tokenUsername ?? config.username;
    const tokenPassword = config.tokenPassword ?? config.password;
    const tokenBearerToken = config.tokenBearerToken ?? config.bearerToken;
    const tokenBody = config.tokenBody ?? config.body;
    const tokenHeaders = config.tokenHeaders ?? config.headers;
    const tokenPath = config.tokenPath || "access_token";

    const result = await fetchPreRequestToken({
      tokenUrl,
      tokenMethod,
      tokenAuthScheme,
      tokenUsername,
      tokenPassword,
      tokenBearerToken,
      tokenGrantType: config.tokenGrantType,
      tokenClientId: config.tokenClientId,
      tokenClientSecret: config.tokenClientSecret,
      tokenScope: config.tokenScope,
      tokenContentType: config.tokenContentType,
      tokenBody,
      tokenHeaders,
      tokenPath,
      caId: config.caId,
      acceptInvalidCert: config.acceptInvalidCert,
    });

    if (!result.success) {
      if (targetDbId && db && canEditTarget) {
        try {
          await db.query("UPDATE $id MERGE $data", {
            id: new RecordId("connection", targetDbId),
            data: { oauthLastError: result.error, updated_at: new Date().toISOString() },
          });
        } catch {}
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          response: result.response,
          latencyMs: result.latencyMs,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const verifiedAt = new Date().toISOString();
    if (targetDbId && db && canEditTarget) {
      try {
        await db.query("UPDATE $id MERGE $data", {
          id: new RecordId("connection", targetDbId),
          data: {
            oauthVerifiedAt: verifiedAt,
            oauthLastError: null,
            oauthProvider: true,
            updated_at: verifiedAt,
          },
        });
      } catch {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: result.token,
        tokenPath,
        headerName: config.tokenHeaderName || "Authorization",
        headerPrefix: config.tokenHeaderPrefix !== undefined ? config.tokenHeaderPrefix : "Bearer ",
        connectionName: config.name,
        response: result.response,
        latencyMs: result.latencyMs,
        oauthVerifiedAt: verifiedAt,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
