import { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getDb } from "~/lib/db";
import { fetchPreRequestToken, normalizeConnection } from "~/lib/connections";

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    let config: any = body;

    if (body.connectionId) {
      const db = await getDb();
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
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
