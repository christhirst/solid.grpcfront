import { f as fetchPreRequestToken } from "./connections-BimqTFQY.js";
import "lodash.get";
import "@grpc/grpc-js";
import "surrealdb";
async function POST(event) {
  try {
    const body = await new Response(event.request.body).json();
    const {
      url,
      method,
      body: reqBody,
      headers: reqHeaders,
      authScheme,
      username,
      password,
      bearerToken,
      tokenPath
    } = body;
    const result = await fetchPreRequestToken({
      tokenUrl: url,
      tokenMethod: method,
      tokenAuthScheme: authScheme,
      tokenUsername: username,
      tokenPassword: password,
      tokenBearerToken: bearerToken,
      tokenBody: reqBody,
      tokenHeaders: reqHeaders,
      tokenPath: tokenPath || "access_token"
    });
    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        error: result.error,
        response: result.response
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      token: result.token,
      response: result.response,
      latencyMs: result.latencyMs
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
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
export {
  POST
};
//# sourceMappingURL=test-token-Dm9X8S-k.js.map
