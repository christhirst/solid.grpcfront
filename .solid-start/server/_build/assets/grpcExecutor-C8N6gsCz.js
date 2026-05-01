import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { mkdtempSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
async function executeGrpcCall(params) {
  const {
    protoContent,
    serverAddress,
    serviceName,
    methodName,
    requestBody,
    useTls,
    metadata
  } = params;
  let tempDir = null;
  try {
    let findService = function(obj, target) {
      if (typeof obj === "function" && (obj.name === target || obj.service)) {
        return obj;
      }
      if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj)) {
          const found = findService(obj[key], target);
          if (found) return found;
        }
      }
      return null;
    };
    tempDir = mkdtempSync(join(tmpdir(), "grpc-exec-"));
    const protoPath = join(tempDir, "service.proto");
    writeFileSync(protoPath, protoContent, "utf-8");
    const packageDefinition = await protoLoader.load(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const grpcObject = grpc.loadPackageDefinition(packageDefinition);
    let ServiceConstructor = null;
    const parts = serviceName.split(".");
    let current = grpcObject;
    for (const part of parts) {
      if (current && current[part]) {
        current = current[part];
      } else {
        current = null;
        break;
      }
    }
    if (typeof current === "function") {
      ServiceConstructor = current;
    }
    if (!ServiceConstructor) {
      const shortName = parts[parts.length - 1];
      if (typeof grpcObject[shortName] === "function") {
        ServiceConstructor = grpcObject[shortName];
      }
    }
    if (!ServiceConstructor) {
      const shortName = parts[parts.length - 1];
      ServiceConstructor = findService(grpcObject, shortName);
    }
    if (!ServiceConstructor) {
      throw new Error(`Service "${serviceName}" not found in proto definition. Available keys: ${Object.keys(grpcObject).join(", ")}`);
    }
    const credentials = useTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
    const client = new ServiceConstructor(serverAddress, credentials);
    const startTime = Date.now();
    const response = await new Promise((resolve, reject) => {
      if (typeof client[methodName] !== "function") {
        reject(new Error(`Method "${methodName}" not found on service "${serviceName}"`));
        return;
      }
      const deadline = new Date(Date.now() + 15e3);
      const grpcMetadata = new grpc.Metadata();
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          grpcMetadata.add(key, value);
        }
      }
      client[methodName](requestBody, grpcMetadata, {
        deadline
      }, (err, response2) => {
        if (err) {
          reject(err);
        } else {
          resolve(response2);
        }
      });
    });
    const latencyMs = Date.now() - startTime;
    client.close();
    return {
      success: true,
      data: response,
      latencyMs
    };
  } catch (err) {
    const isGrpcError = err.code !== void 0 && err.details !== void 0;
    return {
      success: false,
      error: err.message || "Unknown error",
      grpcCode: isGrpcError ? err.code : void 0,
      grpcStatus: isGrpcError ? err.details : void 0,
      metadata: isGrpcError ? err.metadata?.toJSON?.() || {} : void 0
    };
  } finally {
    if (tempDir) {
      try {
        unlinkSync(join(tempDir, "service.proto"));
        unlinkSync(tempDir);
      } catch {
      }
    }
  }
}
export {
  executeGrpcCall as e
};
//# sourceMappingURL=grpcExecutor-C8N6gsCz.js.map
