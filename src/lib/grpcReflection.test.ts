import { afterEach, describe, expect, test } from "bun:test";
import * as grpc from "@grpc/grpc-js";
import * as loader from "@grpc/proto-loader";
import protobuf from "protobufjs";
import descriptor from "protobufjs/ext/descriptor/index.js";
import { reflectGrpcServices } from "./grpcReflection";
import { executeGrpcCall } from "./grpcExecutor";
import { generateSkeleton } from "./protoParser";

const files = [
  { name: "api.proto", package: "example", syntax: "proto3", dependency: ["common.proto"], service: [
    { name: "Echo", method: [{ name: "Send", inputType: ".example.Node", outputType: ".example.Node" }] },
    { name: "Feed", method: [{ name: "Watch", inputType: ".example.Node", outputType: ".example.Node", serverStreaming: true }] },
  ] },
  { name: "common.proto", package: "example", syntax: "proto3", messageType: [{ name: "Node", field: [
    { name: "text", number: 1, label: 1, type: 9 },
    { name: "child", number: 2, label: 1, type: 11, typeName: ".example.Node" },
  ] }] },
];
const wire = protobuf.parse(`syntax = "proto3";
  message Request { string file_by_filename = 3; string file_containing_symbol = 4; optional string list_services = 7; }
  message Response { Files file_descriptor_response = 4; Services list_services_response = 6; Error error_response = 7; }
  message Files { repeated bytes file_descriptor_proto = 1; }
  message Services { repeated Service service = 1; }
  message Service { string name = 1; }
  message Error { int32 error_code = 1; string error_message = 2; }
`, { keepCase: true }).root;
const requestType = wire.lookupType("Request");
const responseType = wire.lookupType("Response");
const servers: grpc.Server[] = [];
afterEach(() => { for (const server of servers.splice(0)) server.forceShutdown(); });

async function startServer(version?: "v1" | "v1alpha", mode: "normal" | "error" | "silent" = "normal") {
  const server = new grpc.Server();
  servers.push(server);
  const requests: any[] = [];
  const definition = loader.loadFileDescriptorSetFromBuffer(Buffer.from(descriptor.FileDescriptorSet.encode({ file: files }).finish()));
  server.addService(definition["example.Echo"] as grpc.ServiceDefinition, {
    Send: (call: any, callback: any) => callback(null, call.request),
  });
  if (version) {
    server.addService({ ServerReflectionInfo: {
      path: `/grpc.reflection.${version}.ServerReflection/ServerReflectionInfo`,
      requestStream: true, responseStream: true,
      requestSerialize: (value: any) => Buffer.from(requestType.encode(value).finish()),
      requestDeserialize: (bytes: Buffer) => requestType.toObject(requestType.decode(bytes)),
      responseSerialize: (value: any) => Buffer.from(responseType.encode(value).finish()),
      responseDeserialize: (bytes: Buffer) => responseType.toObject(responseType.decode(bytes)),
    } }, { ServerReflectionInfo: (call: any) => {
      let sentApi = false;
      call.on("error", () => {});
      call.on("data", (request: any) => {
        requests.push(request);
        if (mode === "silent") return;
        if (mode === "error" || call.metadata.get("authorization")[0] !== "Bearer test") {
          call.write({ error_response: { error_code: grpc.status.PERMISSION_DENIED, error_message: "Reflection denied" } });
        } else if ("list_services" in request) {
          call.write({ list_services_response: { service: [
            { name: "example.Echo" }, { name: "example.Feed" }, { name: `grpc.reflection.${version}.ServerReflection` },
          ] } });
        } else {
          // Deliberately omit imports and descriptors already sent on this stream.
          const file = request.file_by_filename ? files[1] : sentApi ? undefined : files[0];
          if (!request.file_by_filename) sentApi = true;
          call.write({ file_descriptor_response: { file_descriptor_proto: file
            ? [descriptor.FileDescriptorProto.encode(file).finish()] : [] } });
        }
      });
    } });
  }
  const port = await new Promise<number>((resolve, reject) => server.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (err, port) => err ? reject(err) : resolve(port)));
  return { serverAddress: `127.0.0.1:${port}`, requests };
}

describe("gRPC server reflection", () => {
  for (const version of ["v1", "v1alpha"] as const) {
    test(`discovers ${version}, resolves imports, and executes without a proto file`, async () => {
      const server = await startServer(version);
      const schema = await reflectGrpcServices({ ...server, metadata: { authorization: "Bearer test" } });
      expect(schema.parsedProto.services.map(service => service.fullName)).toEqual(["example.Echo", "example.Feed"]);
      expect(schema.parsedProto.services[1].methods[0].responseStream).toBe(true);
      expect(server.requests.some(request => request.file_by_filename === "common.proto")).toBe(true);
      expect(generateSkeleton(schema.parsedProto.messageTypes, "example.Node")).toEqual({ text: "", child: {} });
      const result = await executeGrpcCall({
        protoContent: "", descriptorSet: schema.descriptorSet, serverAddress: server.serverAddress,
        useTls: false, serviceName: "example.Echo", methodName: "Send", requestBody: { text: "hello" },
      });
      expect(result.success).toBe(true);
      expect(result.data.text).toBe("hello");
    });
  }

  test("reports a server without reflection", async () => {
    const server = await startServer();
    await expect(reflectGrpcServices(server)).rejects.toMatchObject({ code: grpc.status.UNIMPLEMENTED });
  });

  test("preserves reflection errors instead of falling back on permission failures", async () => {
    const server = await startServer("v1", "error");
    await expect(reflectGrpcServices(server)).rejects.toMatchObject({ code: grpc.status.PERMISSION_DENIED });
    expect(server.requests).toHaveLength(1);
  });

  test("bounds a nonresponsive reflection stream by its deadline", async () => {
    const server = await startServer("v1", "silent");
    await expect(reflectGrpcServices({ ...server, timeoutMs: 100 })).rejects.toMatchObject({ code: grpc.status.DEADLINE_EXCEEDED });
  });
});
