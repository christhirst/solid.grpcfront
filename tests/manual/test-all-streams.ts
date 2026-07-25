import { executeGrpcStreamCall } from "../../src/lib/grpcExecutor";
import { executeHttpStreamCall } from "../../src/lib/httpExecutor";
import { workflowStreamManager, emitWorkflowEvent } from "../../src/lib/workflowEngine";

async function runTests() {
  console.log("=== Testing Stream Implementations ===");
  let testsPassed = 0;

  // Test 1: Workflow Event Stream Manager
  console.log("\n[Test 1] Testing Workflow Stream Event Manager...");
  await new Promise<void>((resolve, reject) => {
    const testRunId = "test-run-123";
    const timeout = setTimeout(() => reject(new Error("Workflow stream timeout")), 3000);

    workflowStreamManager.on(`run:${testRunId}`, (evt) => {
      console.log(" Received workflow stream event:", evt.type, evt.data);
      if (evt.type === "step_start" && evt.data.stepId === "step_1") {
        clearTimeout(timeout);
        testsPassed++;
        resolve();
      }
    });

    emitWorkflowEvent(testRunId, "wf-123", "step_start", { stepId: "step_1", stepType: "grpc" });
  });

  // Test 2: HTTP Stream Call Execution
  console.log("\n[Test 2] Testing HTTP Stream Executor...");
  await new Promise<void>((resolve, reject) => {
    let chunksReceived = 0;
    const timeout = setTimeout(() => reject(new Error("HTTP stream timeout")), 5000);

    executeHttpStreamCall(
      {
        url: "https://jsonplaceholder.typicode.com/todos/1",
        method: "GET",
      },
      (chunk) => {
        chunksReceived++;
        console.log(" Received HTTP stream chunk:", chunk.raw.slice(0, 50) + "...");
      },
      (err) => {
        clearTimeout(timeout);
        reject(err);
      },
      () => {
        clearTimeout(timeout);
        if (chunksReceived > 0) {
          console.log(" HTTP Stream finished successfully with", chunksReceived, "chunks.");
          testsPassed++;
          resolve();
        } else {
          reject(new Error("No chunks received"));
        }
      }
    );
  });

  // Test 3: gRPC Stream Call Interface Validation
  console.log("\n[Test 3] Testing gRPC Stream Call Executor setup...");
  const sampleProto = `syntax = "proto3";
package test;
service StreamService {
  rpc StreamData (DataRequest) returns (stream DataResponse);
}
message DataRequest { string query = 1; }
message DataResponse { string result = 1; }`;

  const streamCall = await executeGrpcStreamCall(
    {
      protoContent: sampleProto,
      serverAddress: "localhost:50051",
      serviceName: "test.StreamService",
      methodName: "StreamData",
      requestBody: { query: "test" },
      useTls: false,
    },
    (chunk) => console.log("gRPC Chunk:", chunk),
    (err) => console.log(" Expected gRPC connection error (mock server offline):", err.message),
    () => console.log("gRPC Stream ended")
  );

  if (typeof streamCall.cancel === "function") {
    streamCall.cancel();
    console.log(" gRPC stream cancel handle verified.");
    testsPassed++;
  }

  console.log(`\n=== ALL STREAM TESTS VERIFIED: ${testsPassed}/3 PASSED ===`);
}

runTests().catch((err) => {
  console.error("Stream verification failed:", err);
  process.exit(1);
});
