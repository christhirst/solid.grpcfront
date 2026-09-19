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
    const credentials = useTls ? grpc.credentials.createSsl(params.caCert ? Buffer.from(params.caCert) : null, void 0, void 0, params.acceptInvalidCert ? {
      rejectUnauthorized: false,
      checkServerIdentity: () => void 0
    } : void 0) : grpc.credentials.createInsecure();
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
async function executeGrpcStreamCall(params, onData, onError, onEnd) {
  const {
    protoContent,
    serverAddress,
    serviceName,
    methodName,
    requestBody,
    useTls,
    metadata,
    streamInputs
  } = params;
  let tempDir = null;
  let client = null;
  let callStream = null;
  const cleanup = () => {
    if (callStream && typeof callStream.cancel === "function") {
      try {
        callStream.cancel();
      } catch {
      }
    }
    if (client && typeof client.close === "function") {
      try {
        client.close();
      } catch {
      }
    }
    if (tempDir) {
      try {
        unlinkSync(join(tempDir, "service.proto"));
        unlinkSync(tempDir);
      } catch {
      }
    }
  };
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
    tempDir = mkdtempSync(join(tmpdir(), "grpc-stream-"));
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
    let ServiceConstructor = typeof current === "function" ? current : null;
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
      throw new Error(`Service "${serviceName}" not found in proto definition.`);
    }
    const credentials = useTls ? grpc.credentials.createSsl(params.caCert ? Buffer.from(params.caCert) : null, void 0, void 0, params.acceptInvalidCert ? {
      rejectUnauthorized: false,
      checkServerIdentity: () => void 0
    } : void 0) : grpc.credentials.createInsecure();
    client = new ServiceConstructor(serverAddress, credentials);
    if (typeof client[methodName] !== "function") {
      throw new Error(`Method "${methodName}" not found on service "${serviceName}"`);
    }
    const grpcMetadata = new grpc.Metadata();
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        grpcMetadata.add(key, value);
      }
    }
    const methodDef = ServiceConstructor.service?.[methodName] || client[methodName];
    const isRequestStream = methodDef?.requestStream ?? false;
    const isResponseStream = methodDef?.responseStream ?? true;
    const deadline = new Date(Date.now() + 6e4);
    if (isRequestStream && !isResponseStream) {
      callStream = client[methodName](grpcMetadata, {
        deadline
      }, (err, response) => {
        if (err) {
          onError(err);
        } else {
          onData(response);
          onEnd();
        }
        cleanup();
      });
      const inputs = Array.isArray(streamInputs) && streamInputs.length > 0 ? streamInputs : [requestBody];
      for (const input of inputs) {
        callStream.write(input);
      }
      callStream.end();
    } else if (isRequestStream && isResponseStream) {
      callStream = client[methodName](grpcMetadata, {
        deadline
      });
      callStream.on("data", (data) => onData(data));
      callStream.on("error", (err) => {
        onError(err);
        cleanup();
      });
      callStream.on("end", () => {
        onEnd();
        cleanup();
      });
      const inputs = Array.isArray(streamInputs) && streamInputs.length > 0 ? streamInputs : [requestBody];
      for (const input of inputs) {
        callStream.write(input);
      }
      callStream.end();
    } else {
      callStream = client[methodName](requestBody, grpcMetadata, {
        deadline
      });
      callStream.on("data", (data) => onData(data));
      callStream.on("error", (err) => {
        onError(err);
        cleanup();
      });
      callStream.on("end", () => {
        onEnd();
        cleanup();
      });
    }
    return {
      cancel: cleanup
    };
  } catch (err) {
    onError(err);
    cleanup();
    return {
      cancel: () => {
      }
    };
  }
}
export {
  executeGrpcStreamCall as a,
  executeGrpcCall as e
};
//# sourceMappingURL=grpcExecutor-DlteWgV8.js.map
