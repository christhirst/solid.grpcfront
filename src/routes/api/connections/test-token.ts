import { APIEvent } from "@solidjs/start/server";
import { fetchPreRequestToken } from "~/lib/connections";

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    const { url, method, body: reqBody, headers: reqHeaders, authScheme, username, password, bearerToken, tokenPath } = body;

    const result = await fetchPreRequestToken({
      tokenUrl: url,
      tokenMethod: method,
      tokenAuthScheme: authScheme,
      tokenUsername: username,
      tokenPassword: password,
      tokenBearerToken: bearerToken,
      tokenBody: reqBody,
      tokenHeaders: reqHeaders,
      tokenPath: tokenPath || "access_token",
    });

    if (!result.success) {
      return new Response(JSON.stringify({ success: false, error: result.error, response: result.response }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, token: result.token, response: result.response, latencyMs: result.latencyMs }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
