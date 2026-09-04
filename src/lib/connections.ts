import get from "lodash.get";
import * as grpc from "@grpc/grpc-js";
import { Surreal, RecordId } from "surrealdb";

export type ConnectionType = "http" | "grpc" | "surrealdb" | "oauth";
export type AuthType = "none" | "basic" | "bearer" | "oauth";

export interface OAuthConfig {
  tokenUrl?: string;
  tokenMethod?: string;
  tokenAuthScheme?: "none" | "basic" | "bearer";
  tokenUsername?: string;
  tokenPassword?: string;
  tokenBearerToken?: string;
  tokenBody?: string;
  tokenHeaders?: string;
  tokenPath?: string;
  tokenHeaderName?: string;
  tokenHeaderPrefix?: string;
  tokenMetadataKey?: string;
}

export interface ConnectionBase {
  id: string;
  name: string;
  type: ConnectionType;
  description?: string;
  owner?: string;
  visibility?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HttpConnection extends ConnectionBase, OAuthConfig {
  type: "http" | "oauth";
  url: string;
  method?: string;
  headers?: string;
  authType?: AuthType;
  username?: string;
  password?: string;
  bearerToken?: string;
  caId?: string;

  // Legacy fields for backward compatibility
  authScheme?: "none" | "basic" | "bearer";
  body?: string;
}

export interface GrpcConnection extends ConnectionBase, OAuthConfig {
  type: "grpc";
  serverAddress: string;
  useTls?: boolean;
  caId?: string;
  acceptInvalidCert?: boolean;
  protoId?: string;
  metadata?: string;
  authType?: AuthType;
  bearerToken?: string;
}

export interface SurrealDbConnection extends ConnectionBase {
  type: "surrealdb";
  url: string;
  username?: string;
  password?: string;
  namespace?: string;
  database?: string;
}

export type Connection = HttpConnection | GrpcConnection | SurrealDbConnection;

/**
 * Normalizes connection objects from the database or API requests.
 */
export function normalizeConnection(raw: any): Connection {
  if (!raw) return raw;

  const rawId = raw.id ? raw.id.toString().replace(/[⟨⟩]/g, "") : "";
  let type: ConnectionType = raw.type;

  if (!type) {
    if (raw.serverAddress) {
      type = "grpc";
    } else if (raw.namespace || raw.database || (raw.url && (raw.url.startsWith("ws://") || raw.url.startsWith("wss://")))) {
      type = "surrealdb";
    } else {
      type = "http";
    }
  }

  // Handle legacy OAuth connection format
  let authType = raw.authType;
  if (!authType) {
    if (type === "oauth" || (raw.tokenPath && raw.url && !raw.tokenUrl)) {
      authType = "oauth";
    } else if (raw.bearerToken) {
      authType = "bearer";
    } else if (raw.username || raw.password) {
      authType = "basic";
    } else {
      authType = "none";
    }
  }

  // If it's a legacy record where token settings were stored on the top level
  const tokenUrl = raw.tokenUrl || (type === "oauth" || (raw.tokenPath && !raw.tokenUrl) ? raw.url : undefined);
  const tokenMethod = raw.tokenMethod || (type === "oauth" ? (raw.method || "POST") : "POST");
  const tokenAuthScheme = raw.tokenAuthScheme || raw.authScheme || "none";
  const tokenBody = raw.tokenBody || (type === "oauth" ? (raw.body || "{}") : "{}");
  const tokenHeaders = raw.tokenHeaders || (type === "oauth" ? (raw.headers || "{}") : "{}");
  const tokenPath = raw.tokenPath || "access_token";

  return {
    ...raw,
    id: rawId,
    type: type === "oauth" ? "http" : type,
    authType,
    tokenUrl,
    tokenMethod,
    tokenAuthScheme,
    tokenBody,
    tokenHeaders,
    tokenPath,
    tokenHeaderName: raw.tokenHeaderName || "Authorization",
    tokenHeaderPrefix: raw.tokenHeaderPrefix !== undefined ? raw.tokenHeaderPrefix : "Bearer ",
    tokenMetadataKey: raw.tokenMetadataKey || "authorization",
  };
}

/**
 * Helper to fetch a CA cert content from DB by caId
 */
export async function getCaCertContent(caId?: string): Promise<string | undefined> {
  if (!caId || caId === "accept_all") return undefined;
  try {
    const { getDb } = await import("~/lib/db");
    const db = await getDb();
    const dbId = caId.includes(":") ? caId.split(":")[1] : caId;
    const certRecord = await db.select(new RecordId("ca_cert", dbId));
    const cert = Array.isArray(certRecord) ? certRecord[0] : certRecord;
    return cert?.content;
  } catch (err) {
    console.error("[CA] Failed to fetch CA cert content:", err);
    return undefined;
  }
}

/**
 * Fetch OAuth / Pre-request token
 */
export async function fetchPreRequestToken(config: {
  tokenUrl?: string;
  tokenMethod?: string;
  tokenAuthScheme?: string;
  tokenUsername?: string;
  tokenPassword?: string;
  tokenBearerToken?: string;
  tokenBody?: string;
  tokenHeaders?: string;
  tokenPath?: string;
}): Promise<{ success: boolean; token?: string; response?: any; latencyMs?: number; error?: string }> {
  const {
    tokenUrl,
    tokenMethod = "POST",
    tokenAuthScheme = "none",
    tokenUsername,
    tokenPassword,
    tokenBearerToken,
    tokenBody,
    tokenHeaders,
    tokenPath = "access_token",
  } = config;

  if (!tokenUrl) {
    return { success: false, error: "Token endpoint URL is required for OAuth token retrieval." };
  }

  const startTime = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (tokenHeaders) {
      try {
        const parsed = JSON.parse(tokenHeaders);
        Object.assign(headers, parsed);
      } catch (e: any) {
        return { success: false, error: `Failed to parse custom token headers JSON: ${e.message}` };
      }
    }

    if (tokenAuthScheme === "basic" && (tokenUsername || tokenPassword)) {
      const auth = Buffer.from(`${tokenUsername || ""}:${tokenPassword || ""}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    } else if (tokenAuthScheme === "bearer" && tokenBearerToken) {
      headers["Authorization"] = `Bearer ${tokenBearerToken}`;
    }

    let targetUrl = tokenUrl;
    if (targetUrl && !targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      const separator = targetUrl.startsWith("/") ? "" : "/";
      const port = process.env.PORT || 3000;
      targetUrl = `http://127.0.0.1:${port}${separator}${targetUrl}`;
    }

    const fetchOptions: RequestInit = {
      method: tokenMethod || "POST",
      headers,
    };

    if (tokenMethod !== "GET") {
      fetchOptions.body = tokenBody || undefined;
    }

    const res = await fetch(targetUrl, fetchOptions);
    const latencyMs = Date.now() - startTime;

    let resData: any;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      resData = await res.json();
    } else {
      const text = await res.text();
      try {
        resData = JSON.parse(text);
      } catch {
        resData = text;
      }
    }

    if (!res.ok) {
      return {
        success: false,
        latencyMs,
        response: resData,
        error: `Token endpoint returned HTTP ${res.status}: ${typeof resData === "object" ? JSON.stringify(resData) : resData}`,
      };
    }

    const token = get(resData, tokenPath);
    if (!token) {
      return {
        success: false,
        latencyMs,
        response: resData,
        error: `Token not found at JSON path '${tokenPath}'. Full response: ${JSON.stringify(resData)}`,
      };
    }

    return {
      success: true,
      token: String(token),
      response: resData,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: `Failed to fetch access token: ${err.message}`,
    };
  }
}

/**
 * Test HTTP Connection
 */
export async function testHttpConnection(config: any): Promise<any> {
  let tokenResult: any = null;
  let authToken: string | undefined = undefined;

  const authType = config.authType || (config.tokenPath ? "oauth" : "none");

  // 1. Fetch token if OAuth pre-request is configured
  if (authType === "oauth") {
    tokenResult = await fetchPreRequestToken({
      tokenUrl: config.tokenUrl || config.url,
      tokenMethod: config.tokenMethod || config.method || "POST",
      tokenAuthScheme: config.tokenAuthScheme || config.authScheme,
      tokenUsername: config.tokenUsername || config.username,
      tokenPassword: config.tokenPassword || config.password,
      tokenBearerToken: config.tokenBearerToken || config.bearerToken,
      tokenBody: config.tokenBody || config.body,
      tokenHeaders: config.tokenHeaders || config.headers,
      tokenPath: config.tokenPath || "access_token",
    });

    if (!tokenResult.success) {
      return {
        success: false,
        type: "http",
        tokenResult,
        error: `Pre-request token fetch failed: ${tokenResult.error}`,
      };
    }
    authToken = tokenResult.token;
  }

  // If there's no separate target URL or if this is just testing the token retrieval
  const targetUrl = config.url;
  if (!targetUrl || targetUrl === config.tokenUrl) {
    return {
      success: true,
      type: "http",
      tokenResult,
      token: authToken,
      message: "Pre-request token fetched successfully.",
    };
  }

  // 2. Perform test HTTP call to target URL
  const startTime = Date.now();
  try {
    const headers: Record<string, string> = {
      "Accept": "application/json, text/plain, */*",
    };

    if (config.headers) {
      try {
        const parsed = typeof config.headers === "string" ? JSON.parse(config.headers) : config.headers;
        Object.assign(headers, parsed);
      } catch (e: any) {
        return {
          success: false,
          type: "http",
          tokenResult,
          error: `Invalid custom headers JSON: ${e.message}`,
        };
      }
    }

    if (authType === "basic" && (config.username || config.password)) {
      const auth = Buffer.from(`${config.username || ""}:${config.password || ""}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    } else if (authType === "bearer" && config.bearerToken) {
      headers["Authorization"] = `Bearer ${config.bearerToken}`;
    } else if (authType === "oauth" && authToken) {
      const headerName = config.tokenHeaderName || "Authorization";
      const prefix = config.tokenHeaderPrefix !== undefined ? config.tokenHeaderPrefix : "Bearer ";
      headers[headerName] = `${prefix}${authToken}`;
    }

    let resolvedUrl = targetUrl;
    if (resolvedUrl && !resolvedUrl.startsWith("http://") && !resolvedUrl.startsWith("https://")) {
      const separator = resolvedUrl.startsWith("/") ? "" : "/";
      const port = process.env.PORT || 3000;
      resolvedUrl = `http://127.0.0.1:${port}${separator}${resolvedUrl}`;
    }

    const fetchOptions: any = {
      method: config.method || "GET",
      headers,
    };

    if (config.caId) {
      const caCert = await getCaCertContent(config.caId);
      if (caCert || config.caId === "accept_all") {
        fetchOptions.tls = {
          ca: caCert,
          rejectUnauthorized: config.caId !== "accept_all",
        };
      }
    }

    const res = await fetch(resolvedUrl, fetchOptions);
    const latencyMs = Date.now() - startTime;

    let resData: any;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      resData = await res.json();
    } else {
      const text = await res.text();
      try {
        resData = JSON.parse(text);
      } catch {
        resData = text.slice(0, 1000);
      }
    }

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });

    return {
      success: res.ok,
      type: "http",
      status: res.status,
      statusText: res.statusText,
      latencyMs,
      tokenResult,
      token: authToken,
      response: resData,
      headers: resHeaders,
      error: !res.ok ? `HTTP ${res.status}: ${typeof resData === "object" ? JSON.stringify(resData) : resData}` : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      type: "http",
      latencyMs: Date.now() - startTime,
      tokenResult,
      error: `HTTP Request Failed: ${err.message}`,
    };
  }
}

/**
 * Test gRPC Connection
 */
export async function testGrpcConnection(config: any): Promise<any> {
  const { serverAddress, useTls, caId, acceptInvalidCert, metadata, authType } = config;

  if (!serverAddress) {
    return { success: false, type: "grpc", error: "gRPC Server address (host:port) is required." };
  }

  let tokenResult: any = null;
  let authToken: string | undefined = undefined;

  // 1. Fetch pre-request token if configured
  if (authType === "oauth") {
    tokenResult = await fetchPreRequestToken({
      tokenUrl: config.tokenUrl,
      tokenMethod: config.tokenMethod,
      tokenAuthScheme: config.tokenAuthScheme,
      tokenUsername: config.tokenUsername,
      tokenPassword: config.tokenPassword,
      tokenBearerToken: config.tokenBearerToken,
      tokenBody: config.tokenBody,
      tokenHeaders: config.tokenHeaders,
      tokenPath: config.tokenPath || "access_token",
    });

    if (!tokenResult.success) {
      return {
        success: false,
        type: "grpc",
        tokenResult,
        error: `Pre-request token fetch failed: ${tokenResult.error}`,
      };
    }
    authToken = tokenResult.token;
  }

  const startTime = Date.now();
  try {
    let caCert: string | undefined = undefined;
    if (caId) {
      caCert = await getCaCertContent(caId);
    }

    const credentials = useTls
      ? grpc.credentials.createSsl(
          caCert ? Buffer.from(caCert) : null,
          undefined,
          undefined,
          acceptInvalidCert || caId === "accept_all" ? { rejectUnauthorized: false, checkServerIdentity: () => undefined } : undefined,
        )
      : grpc.credentials.createInsecure();

    const client = new grpc.Client(serverAddress, credentials);

    // Wait for channel connectivity state
    const deadline = new Date(Date.now() + 5000); // 5 seconds connection deadline

    const connected = await new Promise<boolean>((resolve) => {
      client.waitForReady(deadline, (err) => {
        if (err) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });

    const latencyMs = Date.now() - startTime;
    client.close();

    if (!connected) {
      return {
        success: false,
        type: "grpc",
        serverAddress,
        latencyMs,
        tokenResult,
        token: authToken,
        error: `Failed to establish connection to gRPC server at ${serverAddress} within 5s timeout.`,
      };
    }

    return {
      success: true,
      type: "grpc",
      serverAddress,
      useTls: !!useTls,
      latencyMs,
      tokenResult,
      token: authToken,
      message: `Successfully connected to gRPC server at ${serverAddress}${useTls ? " (TLS)" : " (Insecure)"}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      type: "grpc",
      serverAddress,
      latencyMs: Date.now() - startTime,
      tokenResult,
      error: `gRPC Connection Error: ${err.message}`,
    };
  }
}

/**
 * Test SurrealDB Connection
 */
export async function testSurrealDbConnection(config: any): Promise<any> {
  const { url, username, password, namespace, database } = config;

  if (!url) {
    return { success: false, type: "surrealdb", error: "SurrealDB endpoint URL is required." };
  }

  const startTime = Date.now();
  try {
    const s = new Surreal();
    
    // Connect and authenticate
    if (username || password) {
      await s.connect(url, {
        authentication: { username: username || "root", password: password || "" },
      });
    } else {
      await s.connect(url);
    }

    if (namespace) {
      await s.use({ namespace, database: database || undefined });
    }

    // Run test query
    const result = await s.query("INFO FOR DB;");
    const latencyMs = Date.now() - startTime;
    await s.close();

    return {
      success: true,
      type: "surrealdb",
      url,
      namespace: namespace || "default",
      database: database || "default",
      latencyMs,
      info: result,
      message: `Successfully connected to SurrealDB at ${url} (NS: ${namespace || "default"}, DB: ${database || "default"}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      type: "surrealdb",
      url,
      latencyMs: Date.now() - startTime,
      error: `SurrealDB Connection Failed: ${err.message}`,
    };
  }
}
