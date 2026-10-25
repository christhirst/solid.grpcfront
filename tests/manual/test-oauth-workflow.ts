import { isOAuthProvider, normalizeConnection, fetchPreRequestToken } from "~/lib/connections";
import { parseBracketTokens } from "~/lib/workflowVariableChecker";

console.log("--- 1. Testing isOAuthProvider logic ---");

const oauthConn = normalizeConnection({
  id: "connection:oauth_test",
  name: "FerrisKey IDP",
  type: "http",
  authType: "oauth",
  tokenUrl: "http://127.0.0.1:9999/token",
  tokenMethod: "POST",
  oauthProvider: true,
});
if (!isOAuthProvider(oauthConn)) {
  throw new Error("oauthConn should be an OAuth provider");
}

const bearerConnWithOldTokenUrl = normalizeConnection({
  id: "connection:bearer_stale",
  name: "Get Users from Ferriskey",
  type: "http",
  authType: "bearer",
  bearerToken: "static-token",
  tokenUrl: "http://127.0.0.1:9999/users",
});
if (isOAuthProvider(bearerConnWithOldTokenUrl)) {
  throw new Error("bearerConnWithOldTokenUrl should NOT be considered an OAuth provider because authType is bearer");
}

const grpcConn = normalizeConnection({
  id: "connection:grpc_server",
  name: "gRPC Microservice",
  type: "grpc",
  serverAddress: "127.0.0.1:50051",
});
if (isOAuthProvider(grpcConn)) {
  throw new Error("grpcConn should NOT be considered an OAuth provider");
}

console.log("✓ isOAuthProvider correctly filters connections!");

console.log("--- 2. Testing parseBracketTokens with oauth.* namespace ---");
const bracketVars = parseBracketTokens("Bearer {{ oauth.ferriskey.access_token }} {{ steps.auth_tok.response.access_token }}");
if (!bracketVars.every((v) => v.direction === "up")) {
  throw new Error("oauth.* and steps.* bracket variables should be categorized as upstream ('up')");
}
console.log("✓ parseBracketTokens recognizes oauth.* namespaces as upstream!");

console.log("--- 3. Testing Mock Token Endpoint and Workflow Token Execution ---");
let tokenCalls = 0;
let apiCalls = 0;
let lastAuthHeader = "";

const mockServer = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/token") {
      tokenCalls++;
      const body = await req.text();
      const params = new URLSearchParams(body);
      if (params.get("grant_type") === "password" && params.get("client_id") === "admin-cli") {
        return Response.json({ access_token: "mock-jwt-token-42", expires_in: 3600 });
      }
      return new Response("Invalid token params: " + body, { status: 400 });
    }
    if (url.pathname === "/api/users") {
      apiCalls++;
      lastAuthHeader = req.headers.get("authorization") || "";
      if (lastAuthHeader === "Bearer mock-jwt-token-42") {
        return Response.json({ users: [{ id: "u1", username: "admin" }] });
      }
      return new Response("Unauthorized", { status: 401 });
    }
    return new Response("Not found: " + url.pathname, { status: 404 });
  },
});

try {
  const tokenRes = await fetchPreRequestToken({
    tokenUrl: `http://127.0.0.1:${mockServer.port}/token`,
    tokenMethod: "POST",
    tokenContentType: "application/x-www-form-urlencoded",
    tokenGrantType: "password",
    tokenClientId: "admin-cli",
    tokenUsername: "admin",
    tokenPassword: "secretPassword",
    tokenPath: "access_token",
  });

  if (!tokenRes.success || tokenRes.token !== "mock-jwt-token-42") {
    throw new Error("Pre-request token fetch failed: " + JSON.stringify(tokenRes));
  }
  console.log("✓ Pre-request token fetched successfully:", tokenRes.token);

  // Test calling API with token
  const apiRes = await fetch(`http://127.0.0.1:${mockServer.port}/api/users`, {
    headers: { Authorization: `Bearer ${tokenRes.token}` },
  });
  if (!apiRes.ok) {
    throw new Error("API call with token failed: " + apiRes.status);
  }
  const apiData = await apiRes.json();
  if (!apiData.users || apiData.users[0].username !== "admin") {
    throw new Error("Unexpected API response: " + JSON.stringify(apiData));
  }
  console.log("✓ Protected API call succeeded with token! Users:", apiData.users);

} finally {
  mockServer.stop();
}

console.log("\nALL OAUTH WORKFLOW AUTOMATED TESTS PASSED!");
