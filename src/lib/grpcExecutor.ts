import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { writeFileSync, rmSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface GrpcCallParams {
  protoContent: string;
  /** Base64 FileDescriptorSet discovered through server reflection. */
  descriptorSet?: string;
  serverAddress: string;
  serviceName: string;
  methodName: string;
  requestBody: Record<string, any>;
  useTls: boolean;
  /** PEM-encoded CA certificate to trust. When set, overrides system root CAs. */
  caCert?: string;
  /** Use TLS but do not validate the peer certificate. Intended for development only. */
  acceptInvalidCert?: boolean;
  metadata?: Record<string, string>;
}

export interface GrpcCallResult {
  success: boolean;
  data?: any;
  error?: string;
  grpcCode?: number;
  grpcStatus?: string;
  metadata?: any;
  latencyMs?: number;
}

/**
 * Common utility to execute a dynamic unary gRPC call from proto content.
 */
export async function executeGrpcCall(params: GrpcCallParams): Promise<GrpcCallResult> {
  const { protoContent, serverAddress, serviceName, methodName, requestBody, useTls, metadata } = params;
  let tempDir: string | null = null;
  let client: any = null;

  try {
    const loaderOptions = {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    };
    let packageDefinition: protoLoader.PackageDefinition;
    if (params.descriptorSet) {
      packageDefinition = protoLoader.loadFileDescriptorSetFromBuffer(Buffer.from(params.descriptorSet, "base64"), loaderOptions);
    } else {
      tempDir = mkdtempSync(join(tmpdir(), "grpc-exec-"));
      const protoPath = join(tempDir, "service.proto");
      writeFileSync(protoPath, protoContent, "utf-8");
      packageDefinition = await protoLoader.load(protoPath, loaderOptions);
    }

    const grpcObject = grpc.loadPackageDefinition(packageDefinition);

    let ServiceConstructor: any = null;
    
    // Helper to find service recursively in the gRPC object
    function findService(obj: any, target: string): any {
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
    }

    // 1. Try direct path lookup (e.g. "mynamespace.MyService")
    const parts = serviceName.split(".");
    let current: any = grpcObject;
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

    // 2. Fallback: Search for the short name at root (e.g. if passed "MyService" but it's at root)
    if (!ServiceConstructor) {
      const shortName = parts[parts.length - 1];
      if (typeof grpcObject[shortName] === "function") {
        ServiceConstructor = grpcObject[shortName];
      }
    }

    // 3. Last Resort: Recursive search for the short name anywhere in the object
    if (!ServiceConstructor) {
      const shortName = parts[parts.length - 1];
      ServiceConstructor = findService(grpcObject, shortName);
    }

    if (!ServiceConstructor) {
      throw new Error(`Service "${serviceName}" not found in proto definition. Available keys: ${Object.keys(grpcObject).join(", ")}`);
    }

    const credentials = useTls
      ? grpc.credentials.createSsl(
          params.caCert ? Buffer.from(params.caCert) : null,
          undefined,
          undefined,
          params.acceptInvalidCert ? { rejectUnauthorized: false, checkServerIdentity: () => undefined } : undefined,
        )
      : grpc.credentials.createInsecure();

    client = new ServiceConstructor(serverAddress, credentials);

    const startTime = Date.now();

    const response = await new Promise<any>((resolve, reject) => {
      if (typeof client[methodName] !== "function") {
        reject(new Error(`Method "${methodName}" not found on service "${serviceName}"`));
        return;
      }


      const deadline = new Date(Date.now() + 15000); // 15s timeout

      // Create gRPC metadata if provided
      const grpcMetadata = new grpc.Metadata();
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          grpcMetadata.add(key, value);
        }
      }

      client[methodName](requestBody, grpcMetadata, { deadline }, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });

    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      data: response,
      latencyMs,
    };
  } catch (err: any) {
    const isGrpcError = err.code !== undefined && err.details !== undefined;
    return {
      success: false,
      error: err.message || "Unknown error",
      grpcCode: isGrpcError ? err.code : undefined,
      grpcStatus: isGrpcError ? err.details : undefined,
      metadata: isGrpcError ? err.metadata?.toJSON?.() || {} : undefined,
    };
  } finally {
    client?.close();
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}

export interface GrpcStreamCallParams extends GrpcCallParams {
  streamType?: "server" | "client" | "bidi";
  streamInputs?: Record<string, any>[];
}

/**
 * Execute dynamic streaming gRPC call (server, client, or bidirectional streaming).
 */
export async function executeGrpcStreamCall(
  params: GrpcStreamCallParams,
  onData: (chunk: any) => void,
  onError: (error: any) => void,
  onEnd: () => void
): Promise<{ cancel: () => void }> {
  const { protoContent, serverAddress, serviceName, methodName, requestBody, useTls, metadata, streamInputs } = params;
  let tempDir: string | null = null;
  let client: any = null;
  let callStream: any = null;

  const cleanup = () => {
    if (callStream && typeof callStream.cancel === "function") {
      try { callStream.cancel(); } catch {}
    }
    if (client && typeof client.close === "function") {
      try { client.close(); } catch {}
    }
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  };

  try {
    const loaderOptions = {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    };
    let packageDefinition: protoLoader.PackageDefinition;
    if (params.descriptorSet) {
      packageDefinition = protoLoader.loadFileDescriptorSetFromBuffer(Buffer.from(params.descriptorSet, "base64"), loaderOptions);
    } else {
      tempDir = mkdtempSync(join(tmpdir(), "grpc-stream-"));
      const protoPath = join(tempDir, "service.proto");
      writeFileSync(protoPath, protoContent, "utf-8");
      packageDefinition = await protoLoader.load(protoPath, loaderOptions);
    }

    const grpcObject = grpc.loadPackageDefinition(packageDefinition);

    function findService(obj: any, target: string): any {
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
    }

    const parts = serviceName.split(".");
    let current: any = grpcObject;
    for (const part of parts) {
      if (current && current[part]) {
        current = current[part];
      } else {
        current = null;
        break;
      }
    }

    let ServiceConstructor: any = typeof current === "function" ? current : null;
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

    const credentials = useTls
      ? grpc.credentials.createSsl(
          params.caCert ? Buffer.from(params.caCert) : null,
          undefined,
          undefined,
          params.acceptInvalidCert ? { rejectUnauthorized: false, checkServerIdentity: () => undefined } : undefined,
        )
      : grpc.credentials.createInsecure();


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

    // Identify method stream characteristics from client prototype or definition if available
    const methodDef = ServiceConstructor.service?.[methodName] || client[methodName];
    const isRequestStream = methodDef?.requestStream ?? false;
    const isResponseStream = methodDef?.responseStream ?? true; // Default to streaming response if requested

    const deadline = new Date(Date.now() + 60000); // 60s timeout for stream

    if (isRequestStream && !isResponseStream) {
      // Client streaming
      callStream = client[methodName](grpcMetadata, { deadline }, (err: any, response: any) => {
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
      // Bidirectional streaming
      callStream = client[methodName](grpcMetadata, { deadline });

      callStream.on("data", (data: any) => onData(data));
      callStream.on("error", (err: any) => {
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
      // Server streaming (or standard call executed as stream)
      callStream = client[methodName](requestBody, grpcMetadata, { deadline });

      callStream.on("data", (data: any) => onData(data));
      callStream.on("error", (err: any) => {
        onError(err);
        cleanup();
      });
      callStream.on("end", () => {
        onEnd();
        cleanup();
      });
    }

    return {
      cancel: cleanup,
    };
  } catch (err: any) {
    onError(err);
    cleanup();
    return { cancel: () => {} };
  }
}
