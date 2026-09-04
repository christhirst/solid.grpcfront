import {
  normalizeConnection,
  testHttpConnection,
  testGrpcConnection,
  testSurrealDbConnection,
  type Connection,
} from "../../src/lib/connections.ts";

async function runTests() {
  console.log("=== 1. Testing normalizeConnection ===");

  // HTTP connection normalization
  const rawHttp = {
    id: "connection:http_test",
    name: "Stripe API",
    type: "http",
    url: "https://api.stripe.com/v1",
    method: "POST",
    headers: '{"Accept": "application/json"}',
    authType: "oauth",
    tokenUrl: "https://auth.stripe.com/token",
    tokenPath: "access_token",
  };
  const normHttp = normalizeConnection(rawHttp);
  console.log("Normalized HTTP:", normHttp.type === "http" && normHttp.authType === "oauth" ? "PASS" : "FAIL");

  // gRPC connection normalization
  const rawGrpc = {
    id: "connection:grpc_test",
    name: "User Service",
    serverAddress: "127.0.0.1:50051",
    useTls: true,
  };
  const normGrpc = normalizeConnection(rawGrpc);
  console.log("Normalized gRPC (inferred type):", normGrpc.type === "grpc" && normGrpc.useTls === true ? "PASS" : "FAIL");

  // SurrealDB connection normalization
  const rawSurreal = {
    id: "connection:surreal_test",
    name: "Main DB",
    url: "ws://127.0.0.1:8000/rpc",
    namespace: "solidflow",
    database: "main",
  };
  const normSurreal = normalizeConnection(rawSurreal);
  console.log("Normalized SurrealDB (inferred type):", normSurreal.type === "surrealdb" && normSurreal.namespace === "solidflow" ? "PASS" : "FAIL");

  // Legacy OAuth connection normalization
  const rawLegacy = {
    id: "connection:legacy_1",
    name: "Legacy Auth",
    url: "https://auth.example.com/token",
    method: "POST",
    authScheme: "basic",
    username: "user",
    password: "pass",
    body: '{"grant_type":"client_credentials"}',
    tokenPath: "token.access",
  };
  const normLegacy = normalizeConnection(rawLegacy);
  console.log("Normalized Legacy OAuth:", normLegacy.type === "http" && normLegacy.authType === "oauth" && normLegacy.tokenUrl === "https://auth.example.com/token" && normLegacy.tokenPath === "token.access" ? "PASS" : "FAIL");

  console.log("\n=== 2. Testing testHttpConnection ===");
  const httpRes = await testHttpConnection({
    url: "https://jsonplaceholder.typicode.com/todos/1",
    method: "GET",
    authType: "none",
  });
  console.log("HTTP GET Status:", httpRes.status, httpRes.success ? "PASS" : "FAIL");

  console.log("\n=== 3. Testing testGrpcConnection (graceful error / handshake) ===");
  const grpcRes = await testGrpcConnection({
    serverAddress: "127.0.0.1:59999", // non-existent gRPC port
    useTls: false,
    authType: "none",
  });
  console.log("gRPC unreachable connection handled cleanly:", !grpcRes.success && grpcRes.error ? "PASS" : "FAIL");

  console.log("\n=== All Unit/Integration Connection Tests Completed ===");
}

runTests().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
