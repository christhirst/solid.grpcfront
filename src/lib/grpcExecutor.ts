import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { createHash } from "node:crypto";
import { writeFileSync, rmSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { toAuthzenGrpcRequest, fromAuthzenGrpcResponse } from "~/lib/authzenProto";

const LOADER_OPTIONS: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const MAX_PROTO_CACHE = 50;
const MAX_CLIENT_CACHE = 64;
const CLIENT_IDLE_TTL_MS = 5 * 60 * 1000;

const grpcObjectCache = new Map<string, Promise<any>>();
const grpcClientCache = new Map<string, { client: any; lastUsed: number }>();
let protoHits = 0;
let protoMisses = 0;

function sha1(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

const grpcSweepTimer = setInterval(() => {
  const cutoff = Date.now() - CLIENT_IDLE_TTL_MS;
  for (const [k, entry] of grpcClientCache) {
    if (entry.lastUsed < cutoff) {
      grpcClientCache.delete(k);
      try {
        entry.client?.close?.();
      } catch {}
    }
  }
}, 60_000);
if (typeof (grpcSweepTimer as any).unref === "function") {
  (grpcSweepTimer as any).unref();
}

export function getGrpcCacheStats() {
  return {
    protoHits,
    protoMisses,
    protoSize: grpcObjectCache.size,
    clientSize: grpcClientCache.size,
  };
}

export function _clearGrpcCachesForTest(): void {
  grpcObjectCache.clear();
  for (const entry of grpcClientCache.values()) {
    try {
      entry.client?.close?.();
    } catch {}
  }
  grpcClientCache.clear();
  protoHits = 0;
  protoMisses = 0;
}

async function getOrLoadGrpcObject(
  protoContent: string,
  descriptorSet?: string
): Promise<{ grpcObject: any; protoHash: string }> {
  const protoHash = sha1(descriptorSet ? `desc:${descriptorSet}` : `proto:${protoContent || ""}`);
  const existing = grpcObjectCache.get(protoHash);
  if (existing) {
    protoHits++;
    grpcObjectCache.delete(protoHash);
    grpcObjectCache.set(protoHash, existing);
    return { grpcObject: await existing, protoHash };
  }

  protoMisses++;
  while (grpcObjectCache.size >= MAX_PROTO_CACHE) {
    const oldestKey = grpcObjectCache.keys().next().value;
    if (oldestKey === undefined) break;
    grpcObjectCache.delete(oldestKey);
  }

  const loadPromise = (async () => {
    let packageDefinition: protoLoader.PackageDefinition;
    if (descriptorSet) {
      packageDefinition = protoLoader.loadFileDescriptorSetFromBuffer(
        Buffer.from(descriptorSet, "base64"),
        LOADER_OPTIONS
      );
    } else {
      const tempDir = mkdtempSync(join(tmpdir(), "grpc-exec-"));
      try {
        const protoPath = join(tempDir, "service.proto");
        writeFileSync(protoPath, protoContent, "utf-8");
        packageDefinition = await protoLoader.load(protoPath, LOADER_OPTIONS);
      } finally {
        try {
          rmSync(tempDir, { recursive: true, force: true });
        } catch {}
      }
    }
    return grpc.loadPackageDefinition(packageDefinition);
  })().catch((err) => {
    if (grpcObjectCache.get(protoHash) === loadPromise) {
      grpcObjectCache.delete(protoHash);
    }
    throw err;
  });

  grpcObjectCache.set(protoHash, loadPromise);
  return { grpcObject: await loadPromise, protoHash };
}

function findServiceRecursively(obj: any, target: string): any {
  if (typeof obj === "function" && (obj.name === target || obj.service)) {
    return obj;
  }
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      const found = findServiceRecursively(obj[key], target);
      if (found) return found;
    }
  }
  return null;
}

function findServiceConstructor(grpcObject: any, serviceName: string): any {
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
  if (typeof current === "function") return current;

  const shortName = parts[parts.length - 1];
  if (typeof grpcObject[shortName] === "function") {
    return grpcObject[shortName];
  }
  return findServiceRecursively(grpcObject, shortName);
}

function getOrCreateGrpcClient(
  ServiceConstructor: any,
  protoHash: string,
  params: Pick<GrpcCallParams, "serverAddress" | "serviceName" | "useTls" | "caCert" | "acceptInvalidCert">
): any {
  const caHash = params.caCert ? sha1(params.caCert) : "";
  const clientKey = `${params.serverAddress}|${params.useTls ? 1 : 0}|${caHash}|${params.acceptInvalidCert ? 1 : 0}|${protoHash}|${params.serviceName}`;

  const existing = grpcClientCache.get(clientKey);
  if (existing) {
    existing.lastUsed = Date.now();
    grpcClientCache.delete(clientKey);
    grpcClientCache.set(clientKey, existing);
    return existing.client;
  }

  while (grpcClientCache.size >= MAX_CLIENT_CACHE) {
    const oldestKey = grpcClientCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = grpcClientCache.get(oldestKey);
    grpcClientCache.delete(oldestKey);
    try {
      oldest?.client?.close?.();
    } catch {}
  }

  const credentials = params.useTls
    ? grpc.credentials.createSsl(
        params.caCert ? Buffer.from(params.caCert) : null,
        undefined,
        undefined,
        params.acceptInvalidCert ? { rejectUnauthorized: false, checkServerIdentity: () => undefined } : undefined
      )
    : grpc.credentials.createInsecure();

  const client = new ServiceConstructor(params.serverAddress, credentials);
  grpcClientCache.set(clientKey, { client, lastUsed: Date.now() });
  return client;
}

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
  /** Optional call deadline timeout in milliseconds (defaults to 15000ms for unary, 60000ms for streams). */
  timeoutMs?: number;
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
  const { protoContent, serverAddress, serviceName, methodName, requestBody, metadata } = params;

  try {
    const { grpcObject, protoHash } = await getOrLoadGrpcObject(protoContent, params.descriptorSet);
    const ServiceConstructor = findServiceConstructor(grpcObject, serviceName);

    if (!ServiceConstructor) {
      throw new Error(`Service "${serviceName}" not found in proto definition. Available keys: ${Object.keys(grpcObject).join(", ")}`);
    }

    const client = getOrCreateGrpcClient(ServiceConstructor, protoHash, params);

    const startTime = Date.now();

    const response = await new Promise<any>((resolve, reject) => {
      if (typeof client[methodName] !== "function") {
        reject(new Error(`Method "${methodName}" not found on service "${serviceName}"`));
        return;
      }


      const effectiveTimeoutMs = Number(params.timeoutMs) > 0 ? Number(params.timeoutMs) : 15000;
      const deadline = new Date(Date.now() + effectiveTimeoutMs);

      // Create gRPC metadata if provided
      const grpcMetadata = new grpc.Metadata();
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          grpcMetadata.add(key, value);
        }
      }

      const usesStructProto =
        Boolean(protoContent && protoContent.includes("google/protobuf/struct.proto")) ||
        serviceName.includes("authzen");
      const effectiveRequestBody = usesStructProto
        ? toAuthzenGrpcRequest(requestBody || {})
        : requestBody;

      client[methodName](effectiveRequestBody, grpcMetadata, { deadline }, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(usesStructProto ? fromAuthzenGrpcResponse(response) : response);
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
  const { protoContent, serviceName, methodName, requestBody, metadata, streamInputs } = params;
  let callStream: any = null;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (callStream && typeof callStream.cancel === "function") {
      try { callStream.cancel(); } catch {}
    }
  };

  try {
    const { grpcObject, protoHash } = await getOrLoadGrpcObject(protoContent, params.descriptorSet);
    const ServiceConstructor = findServiceConstructor(grpcObject, serviceName);

    if (!ServiceConstructor) {
      throw new Error(`Service "${serviceName}" not found in proto definition.`);
    }

    const client = getOrCreateGrpcClient(ServiceConstructor, protoHash, params);

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

    const effectiveTimeoutMs = Number(params.timeoutMs) > 0 ? Number(params.timeoutMs) : 60000;
    const deadline = new Date(Date.now() + effectiveTimeoutMs);

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
