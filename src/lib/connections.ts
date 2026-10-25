import get from "lodash.get";
import * as grpc from "@grpc/grpc-js";
import { Surreal, RecordId } from "surrealdb";
import { listS3Objects } from "~/lib/s3Executor";

export type ConnectionType = "http" | "grpc" | "surrealdb" | "oauth" | "s3";
export type AuthType = "none" | "basic" | "bearer" | "oauth";

export interface OAuthConfig {
  tokenUrl?: string;
  tokenMethod?: string;
  tokenAuthScheme?: "none" | "basic" | "bearer";
  tokenUsername?: string;
  tokenPassword?: string;
  tokenBearerToken?: string;
  tokenGrantType?: "password" | "client_credentials" | "custom";
  tokenClientId?: string;
  tokenClientSecret?: string;
  tokenScope?: string;
  tokenContentType?: "application/x-www-form-urlencoded" | "application/json";
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
  tags?: string[];
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
  username?: string;
  password?: string;
  bearerToken?: string;
}

export interface SurrealDbConnection extends ConnectionBase {
  type: "surrealdb";
  url: string;
  username?: string;
  password?: string;
  namespace?: string;
  database?: string;
  timeoutMs?: number;
}

export interface S3Connection extends ConnectionBase {
  type: "s3";
  endpoint: string;
  region?: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  prefix?: string;
  forcePathStyle?: boolean;
  caId?: string;
  acceptInvalidCert?: boolean;
}

export type Connection = HttpConnection | GrpcConnection | SurrealDbConnection | S3Connection;

/**
 * Normalizes connection objects from the database or API requests.
 */
export function normalizeConnection(raw: any): Connection {
  if (!raw) return raw;

  const rawId = raw.id ? raw.id.toString().replace(/[⟨⟩]/g, "") : "";
  let type: ConnectionType = raw.type;

  if (!type) {
    if (raw.bucket || raw.accessKeyId) {
      type = "s3";
    } else if (raw.serverAddress) {
      type = "grpc";
    } else if (raw.namespace || raw.database || (raw.url && (raw.url.startsWith("ws://") || raw.url.startsWith("wss://")))) {
      type = "surrealdb";
    } else {
      type = "http";
    }
  }

  if (type === "s3") {
    return {
      ...raw,
      id: rawId,
      type: "s3",
      endpoint: raw.endpoint || raw.url || "https://s3.amazonaws.com",
      region: raw.region || "us-east-1",
      bucket: (raw.bucket || "").replace(/^s3:\/\//i, "").replace(/\/+$/, ""),
      accessKeyId: raw.accessKeyId || "",
      secretAccessKey: raw.secretAccessKey || "",
      sessionToken: raw.sessionToken || undefined,
      prefix: raw.prefix || "",
      forcePathStyle: raw.forcePathStyle !== undefined ? Boolean(raw.forcePathStyle) : true,
      caId: raw.caId || undefined,
      acceptInvalidCert: raw.acceptInvalidCert !== undefined ? Boolean(raw.acceptInvalidCert) : undefined,
    };
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

  let tokenContentType = raw.tokenContentType;
  let tokenGrantType = raw.tokenGrantType;
  let tokenClientId = raw.tokenClientId;
  let tokenClientSecret = raw.tokenClientSecret;
  let tokenScope = raw.tokenScope;
  let tokenUsername = raw.tokenUsername;
  let tokenPassword = raw.tokenPassword;

  // Infer URL-encoded OIDC fields if tokenBody was saved as a form-urlencoded string
  if (typeof tokenBody === "string" && tokenBody.trim() && !tokenBody.trim().startsWith("{") && tokenBody.includes("=")) {
    try {
      const params = new URLSearchParams(tokenBody.trim());
      if (!tokenContentType) tokenContentType = "application/x-www-form-urlencoded";
      if (!tokenGrantType && params.get("grant_type")) tokenGrantType = params.get("grant_type") as any;
      if (!tokenClientId && params.get("client_id")) tokenClientId = params.get("client_id") || undefined;
      if (!tokenClientSecret && params.get("client_secret")) tokenClientSecret = params.get("client_secret") || undefined;
      if (!tokenScope && params.get("scope")) tokenScope = params.get("scope") || undefined;
      if (!tokenUsername && params.get("username")) tokenUsername = params.get("username") || undefined;
      if (!tokenPassword && params.get("password")) tokenPassword = params.get("password") || undefined;
    } catch {}
  }

  return {
    ...raw,
    id: rawId,
    type: type === "oauth" ? "http" : type,
    authType,
    tokenUrl,
    tokenMethod,
    tokenAuthScheme,
    tokenUsername,
    tokenPassword,
    tokenGrantType,
    tokenClientId,
    tokenClientSecret,
    tokenScope,
    tokenContentType,
    tokenBody,
    tokenHeaders,
    tokenPath,
    tokenHeaderName: raw.tokenHeaderName || "Authorization",
    tokenHeaderPrefix: raw.tokenHeaderPrefix !== undefined ? raw.tokenHeaderPrefix : "Bearer ",
    tokenMetadataKey: raw.tokenMetadataKey || "authorization",
    timeoutMs: raw.timeoutMs !== undefined ? Number(raw.timeoutMs) : undefined,
  };
}

/**
 * Helper to fetch a CA cert content from DB by caId
 */
export async function getCaCertContent(caId?: string): Promise<string | undefined> {
  if (!caId || caId === "accept_all" || caId === "__accept_all__") return undefined;
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

function normalizeHttpEndpointUrl(rawUrl: string): string {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const firstSegment = trimmed.split("/")[0];
  if (
    !trimmed.startsWith("/") &&
    firstSegment.toLowerCase() !== "api" &&
    /^[a-zA-Z0-9._-]+(:\d+)?$/.test(firstSegment)
  ) {
    return `http://${trimmed}`;
  }
  const separator = trimmed.startsWith("/") ? "" : "/";
  const port = process.env.PORT || 3000;
  return `http://127.0.0.1:${port}${separator}${trimmed}`;
}

/**
 * Fetch OAuth / Pre-request token (supports both OIDC application/x-www-form-urlencoded and JSON bodies)
 */
export async function fetchPreRequestToken(config: {
  tokenUrl?: string;
  tokenMethod?: string;
  tokenAuthScheme?: string;
  tokenUsername?: string;
  tokenPassword?: string;
  tokenBearerToken?: string;
  tokenGrantType?: string;
  tokenClientId?: string;
  tokenClientSecret?: string;
  tokenScope?: string;
  tokenContentType?: string;
  tokenBody?: string;
  tokenHeaders?: string;
  tokenPath?: string;
  caId?: string;
  acceptInvalidCert?: boolean;
}): Promise<{ success: boolean; token?: string; response?: any; latencyMs?: number; error?: string }> {
  const {
    tokenUrl,
    tokenMethod = "POST",
    tokenAuthScheme = "none",
    tokenUsername,
    tokenPassword,
    tokenBearerToken,
    tokenGrantType,
    tokenClientId,
    tokenClientSecret,
    tokenScope,
    tokenContentType,
    tokenBody,
    tokenHeaders,
    tokenPath = "access_token",
    caId,
    acceptInvalidCert,
  } = config;

  if (!tokenUrl) {
    return { success: false, error: "Token endpoint URL is required for OAuth token retrieval." };
  }

  const startTime = Date.now();
  try {
    const headers: Record<string, string> = {};

    if (tokenHeaders) {
      try {
        const parsed = typeof tokenHeaders === "string" ? JSON.parse(tokenHeaders) : tokenHeaders;
        if (parsed && typeof parsed === "object") {
          for (const [k, v] of Object.entries(parsed)) {
            headers[k] = String(v);
          }
        }
      } catch (e: any) {
        return { success: false, error: `Failed to parse custom token headers JSON: ${e.message}` };
      }
    }

    const existingContentTypeKey = Object.keys(headers).find((k) => k.toLowerCase() === "content-type");
    const existingContentType = existingContentTypeKey ? headers[existingContentTypeKey] : "";
    const trimmedBody = (tokenBody || "").trim();
    const looksLikeFormString = Boolean(
      trimmedBody &&
      trimmedBody !== "{}" &&
      !trimmedBody.startsWith("{") &&
      !trimmedBody.startsWith("[") &&
      trimmedBody.includes("=")
    );

    const isFormUrlEncoded = Boolean(
      tokenContentType === "application/x-www-form-urlencoded" ||
      existingContentType.toLowerCase().includes("application/x-www-form-urlencoded") ||
      (tokenGrantType && tokenGrantType !== "custom") ||
      tokenClientId ||
      looksLikeFormString
    );

    if (isFormUrlEncoded) {
      if (existingContentTypeKey && existingContentTypeKey !== "Content-Type") {
        delete headers[existingContentTypeKey];
      }
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else if (!existingContentTypeKey) {
      headers["Content-Type"] = "application/json";
    }

    if (tokenAuthScheme === "basic" && (tokenUsername || tokenPassword || tokenClientId || tokenClientSecret)) {
      const basicUser = tokenUsername || tokenClientId || "";
      const basicPass = tokenPassword || tokenClientSecret || "";
      const auth = Buffer.from(`${basicUser}:${basicPass}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    } else if (tokenAuthScheme === "bearer" && tokenBearerToken) {
      headers["Authorization"] = `Bearer ${tokenBearerToken}`;
    }

    let finalBody: string | undefined = undefined;
    if (tokenMethod !== "GET") {
      if (isFormUrlEncoded) {
        const params = new URLSearchParams();
        // First parse existing body if any
        if (trimmedBody && trimmedBody !== "{}") {
          if (trimmedBody.startsWith("{")) {
            try {
              const parsedObj = JSON.parse(trimmedBody);
              if (parsedObj && typeof parsedObj === "object") {
                for (const [k, v] of Object.entries(parsedObj)) {
                  if (v !== undefined && v !== null && v !== "") {
                    params.set(k, String(v));
                  }
                }
              }
            } catch {}
          } else {
            const existingParams = new URLSearchParams(trimmedBody);
            existingParams.forEach((v, k) => params.set(k, v));
          }
        }
        // Apply structured OIDC / FerrisKey fields if provided
        if (tokenGrantType && tokenGrantType !== "custom") {
          params.set("grant_type", tokenGrantType);
        }
        if (tokenClientId) {
          params.set("client_id", tokenClientId);
        }
        if (tokenClientSecret && tokenAuthScheme !== "basic") {
          params.set("client_secret", tokenClientSecret);
        }
        if (tokenAuthScheme !== "basic" && (!tokenGrantType || tokenGrantType === "password")) {
          if (tokenUsername) params.set("username", tokenUsername);
          if (tokenPassword) params.set("password", tokenPassword);
        }
        if (tokenScope) {
          params.set("scope", tokenScope);
        }
        finalBody = params.toString();
      } else {
        finalBody = tokenBody || undefined;
      }
    }

    const targetUrl = normalizeHttpEndpointUrl(tokenUrl);

    const fetchOptions: any = {
      method: tokenMethod || "POST",
      headers,
    };

    if (tokenMethod !== "GET" && finalBody !== undefined) {
      fetchOptions.body = finalBody;
    }

    if (caId || acceptInvalidCert) {
      const caCert = await getCaCertContent(caId);
      const isAcceptAll = Boolean(acceptInvalidCert || caId === "accept_all" || caId === "__accept_all__");
      if (caCert || isAcceptAll) {
        fetchOptions.tls = {
          ca: caCert,
          rejectUnauthorized: !isAcceptAll,
        };
      }
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

    let token = get(resData, tokenPath);
    if (!token && resData && typeof resData === "object") {
      token = resData.access_token ?? resData.token ?? resData.id_token ?? get(resData, "data.access_token");
    }
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

  const authType = config.authType || (config.tokenPath || config.tokenUrl ? "oauth" : "none");

  // 1. Fetch token if OAuth pre-request is configured
  if (authType === "oauth") {
    tokenResult = await fetchPreRequestToken({
      tokenUrl: config.tokenUrl || config.url,
      tokenMethod: config.tokenMethod || config.method || "POST",
      tokenAuthScheme: config.tokenAuthScheme || config.authScheme,
      tokenUsername: config.tokenUsername || config.username,
      tokenPassword: config.tokenPassword || config.password,
      tokenBearerToken: config.tokenBearerToken || config.bearerToken,
      tokenGrantType: config.tokenGrantType,
      tokenClientId: config.tokenClientId,
      tokenClientSecret: config.tokenClientSecret,
      tokenScope: config.tokenScope,
      tokenContentType: config.tokenContentType,
      tokenBody: config.tokenBody || config.body,
      tokenHeaders: config.tokenHeaders || config.headers,
      tokenPath: config.tokenPath || "access_token",
      caId: config.caId,
      acceptInvalidCert: config.acceptInvalidCert,
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
      latencyMs: tokenResult?.latencyMs,
      tokenResult,
      token: authToken,
      response: tokenResult?.response,
      message: "Pre-request access_token fetched successfully.",
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

    const resolvedUrl = normalizeHttpEndpointUrl(targetUrl);

    const fetchOptions: any = {
      method: config.method || "GET",
      headers,
    };

    if (config.caId) {
      const caCert = await getCaCertContent(config.caId);
      const isAcceptAll = config.caId === "accept_all" || config.caId === "__accept_all__";
      if (caCert || isAcceptAll) {
        fetchOptions.tls = {
          ca: caCert,
          rejectUnauthorized: !isAcceptAll,
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
      token: authToken,
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
      tokenGrantType: config.tokenGrantType,
      tokenClientId: config.tokenClientId,
      tokenClientSecret: config.tokenClientSecret,
      tokenScope: config.tokenScope,
      tokenContentType: config.tokenContentType,
      tokenBody: config.tokenBody,
      tokenHeaders: config.tokenHeaders,
      tokenPath: config.tokenPath || "access_token",
      caId: config.caId,
      acceptInvalidCert: config.acceptInvalidCert,
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
  } else if (authType === "basic" && (config.username || config.password)) {
    authToken = `Basic ${Buffer.from(`${config.username || ""}:${config.password || ""}`).toString("base64")}`;
  } else if (authType === "bearer" && config.bearerToken) {
    authToken = `Bearer ${config.bearerToken}`;
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
  const timeoutMs = Number(config.timeoutMs || config.timeout || 5000);

  if (!url) {
    return { success: false, type: "surrealdb", error: "SurrealDB endpoint URL is required." };
  }

  const startTime = Date.now();

  const tryConnect = async (auth?: any) => {
    const s = new Surreal();
    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        try {
          s.close();
        } catch {}
        reject(new Error(`Connection to SurrealDB at ${url} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    });

    try {
      await Promise.race([
        (async () => {
          if (auth) {
            await s.connect(url, { authentication: auth });
          } else {
            await s.connect(url);
          }
          if (namespace) {
            await s.use({ namespace, database: database || undefined });
          }
          // Run test query
          const res = await s.query("INFO FOR DB;");
          return res;
        })(),
        timeoutPromise,
      ]);
      return { client: s };
    } finally {
      clearTimeout(timer);
    }
  };

  // Determine auth attempts order:
  // - If username is "root": try root-level auth first, then scoped
  // - If username is non-root (e.g. "ai"): try DB-scoped first, then NS-scoped, then root fallback
  const authAttempts: Array<any> = [];
  if (username || password) {
    const user = username || "root";
    const pass = password || "";
    if (user === "root") {
      authAttempts.push({ username: user, password: pass });
      if (namespace && database) {
        authAttempts.push({ namespace, database, username: user, password: pass });
      }
    } else {
      if (namespace && database) {
        authAttempts.push({ namespace, database, username: user, password: pass });
      }
      if (namespace) {
        authAttempts.push({ namespace, username: user, password: pass });
      }
      authAttempts.push({ username: user, password: pass });
    }
  } else {
    authAttempts.push(undefined);
  }

  let lastError: any;
  for (const auth of authAttempts) {
    try {
      const { client } = await tryConnect(auth);
      const latencyMs = Date.now() - startTime;
      let infoResult: any = null;
      try {
        infoResult = await client.query("INFO FOR DB;");
      } catch {}
      try {
        await client.close();
      } catch {}

      return {
        success: true,
        type: "surrealdb",
        url,
        namespace: namespace || "default",
        database: database || "default",
        latencyMs,
        info: infoResult,
        message: `Successfully connected to SurrealDB at ${url} (NS: ${namespace || "default"}, DB: ${database || "default"}).`,
      };
    } catch (err: any) {
      lastError = err;
    }
  }

  return {
    success: false,
    type: "surrealdb",
    url,
    latencyMs: Date.now() - startTime,
    error: `SurrealDB Connection Failed: ${lastError?.message || lastError}`,
  };
}

/**
 * Test S3 Connection
 */
export async function testS3Connection(config: any): Promise<any> {
  const endpoint = config.endpoint || config.url || "https://s3.amazonaws.com";
  const bucket = (config.bucket || "").replace(/^s3:\/\//i, "").replace(/\/+$/, "");
  const region = config.region || "us-east-1";

  if (!bucket) {
    return {
      success: false,
      type: "s3",
      error: "S3 Bucket Name is required.",
    };
  }

  let caCert: string | undefined;
  if (config.caId) {
    caCert = await getCaCertContent(config.caId);
  }

  const res = await listS3Objects({
    endpoint,
    region,
    bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken,
    prefix: config.prefix,
    forcePathStyle: config.forcePathStyle !== undefined ? Boolean(config.forcePathStyle) : true,
    caCert,
    acceptInvalidCert: Boolean(config.acceptInvalidCert || config.caId === "accept_all"),
    maxKeys: 10,
  });

  if (!res.success) {
    return {
      success: false,
      type: "s3",
      endpoint,
      bucket,
      latencyMs: res.latencyMs,
      error: res.error,
    };
  }

  return {
    success: true,
    type: "s3",
    endpoint,
    bucket,
    region,
    latencyMs: res.latencyMs,
    response: {
      bucket: res.bucket,
      count: res.count,
      sampleUris: res.uris.slice(0, 5),
    },
    message: `Successfully connected to S3 bucket s3://${bucket} (${res.count} file(s) found${config.prefix ? ` under prefix '${config.prefix}'` : ""}).`,
  };
}

