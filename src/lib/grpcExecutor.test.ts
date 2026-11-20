import { describe, it, expect, afterEach } from "bun:test";
import { executeGrpcCall, getGrpcCacheStats, _clearGrpcCachesForTest } from "./grpcExecutor";

const SAMPLE_PROTO = `
syntax = "proto3";
package test.v1;
service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
}
message HelloRequest { string name = 1; }
message HelloReply { string message = 1; }
`;

describe("grpcExecutor proto and client caching", () => {
  afterEach(() => {
    _clearGrpcCachesForTest();
  });

  it("reuses parsed proto definitions and gRPC clients across calls", async () => {
    _clearGrpcCachesForTest();

    const r1 = await executeGrpcCall({
      protoContent: SAMPLE_PROTO,
      serverAddress: "127.0.0.1:59999",
      serviceName: "test.v1.Greeter",
      methodName: "NonExistentMethod",
      requestBody: {},
      useTls: false,
    });
    expect(r1.success).toBe(false);
    expect(r1.error).toContain("NonExistentMethod");

    const statsAfterFirst = getGrpcCacheStats();
    expect(statsAfterFirst.protoMisses).toBe(1);
    expect(statsAfterFirst.protoHits).toBe(0);
    expect(statsAfterFirst.protoSize).toBe(1);
    expect(statsAfterFirst.clientSize).toBe(1);

    const r2 = await executeGrpcCall({
      protoContent: SAMPLE_PROTO,
      serverAddress: "127.0.0.1:59999",
      serviceName: "test.v1.Greeter",
      methodName: "NonExistentMethod",
      requestBody: {},
      useTls: false,
    });
    expect(r2.success).toBe(false);

    const statsAfterSecond = getGrpcCacheStats();
    expect(statsAfterSecond.protoMisses).toBe(1);
    expect(statsAfterSecond.protoHits).toBe(1);
    expect(statsAfterSecond.protoSize).toBe(1);
    expect(statsAfterSecond.clientSize).toBe(1);
  });
});
