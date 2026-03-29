import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface GrpcCallParams {
  protoContent: string;
  serverAddress: string;
  serviceName: string;
  methodName: string;
  requestBody: Record<string, any>;
  useTls: boolean;
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

  try {
    tempDir = mkdtempSync(join(tmpdir(), "grpc-exec-"));
    const protoPath = join(tempDir, "service.proto");
    writeFileSync(protoPath, protoContent, "utf-8");

    const packageDefinition = await protoLoader.load(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

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
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    const client = new ServiceConstructor(serverAddress, credentials);

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
    client.close();

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
    if (tempDir) {
      try {
        unlinkSync(join(tempDir, "service.proto"));
        unlinkSync(tempDir);
      } catch {
        // ignore
      }
    }
  }
}
