import get from "lodash.get";
import * as grpc from "@grpc/grpc-js";
import { Surreal, RecordId } from "surrealdb";
function normalizeConnection(raw) {
  if (!raw) return raw;
  const rawId = raw.id ? raw.id.toString().replace(/[⟨⟩]/g, "") : "";
  let type = raw.type;
  if (!type) {
    if (raw.serverAddress) {
      type = "grpc";
    } else if (raw.namespace || raw.database || raw.url && (raw.url.startsWith("ws://") || raw.url.startsWith("wss://"))) {
      type = "surrealdb";
    } else {
      type = "http";
    }
  }
  let authType = raw.authType;
  if (!authType) {
    if (type === "oauth" || raw.tokenPath && raw.url && !raw.tokenUrl) {
      authType = "oauth";
    } else if (raw.bearerToken) {
      authType = "bearer";
    } else if (raw.username || raw.password) {
      authType = "basic";
    } else {
      authType = "none";
    }
  }
  const tokenUrl = raw.tokenUrl || (type === "oauth" || raw.tokenPath && !raw.tokenUrl ? raw.url : void 0);
  const tokenMethod = raw.tokenMethod || (type === "oauth" ? raw.method || "POST" : "POST");
  const tokenAuthScheme = raw.tokenAuthScheme || raw.authScheme || "none";
  const tokenBody = raw.tokenBody || (type === "oauth" ? raw.body || "{}" : "{}");
  const tokenHeaders = raw.tokenHeaders || (type === "oauth" ? raw.headers || "{}" : "{}");
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
    tokenHeaderPrefix: raw.tokenHeaderPrefix !== void 0 ? raw.tokenHeaderPrefix : "Bearer ",
    tokenMetadataKey: raw.tokenMetadataKey || "authorization"
  };
}
async function getCaCertContent(caId) {
  if (!caId || caId === "accept_all") return void 0;
  try {
    const {
      getDb
    } = await import("./db-CWsCtsJQ.js").then((n) => n.d);
    const db = await getDb();
    const dbId = caId.includes(":") ? caId.split(":")[1] : caId;
    const certRecord = await db.select(new RecordId("ca_cert", dbId));
    const cert = Array.isArray(certRecord) ? certRecord[0] : certRecord;
    return cert?.content;
  } catch (err) {
    console.error("[CA] Failed to fetch CA cert content:", err);
    return void 0;
  }
}
async function fetchPreRequestToken(config) {
  const {
    tokenUrl,
    tokenMethod = "POST",
    tokenAuthScheme = "none",
    tokenUsername,
    tokenPassword,
    tokenBearerToken,
    tokenBody,
    tokenHeaders,
    tokenPath = "access_token"
  } = config;
  if (!tokenUrl) {
    return {
      success: false,
      error: "Token endpoint URL is required for OAuth token retrieval."
    };
  }
  const startTime = Date.now();
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (tokenHeaders) {
      try {
        const parsed = JSON.parse(tokenHeaders);
        Object.assign(headers, parsed);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse custom token headers JSON: ${e.message}`
        };
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
      const port = process.env.PORT || 3e3;
      targetUrl = `http://127.0.0.1:${port}${separator}${targetUrl}`;
    }
    const fetchOptions = {
      method: tokenMethod || "POST",
      headers
    };
    if (tokenMethod !== "GET") {
      fetchOptions.body = tokenBody || void 0;
    }
    const res = await fetch(targetUrl, fetchOptions);
    const latencyMs = Date.now() - startTime;
    let resData;
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
        error: `Token endpoint returned HTTP ${res.status}: ${typeof resData === "object" ? JSON.stringify(resData) : resData}`
      };
    }
    const token = get(resData, tokenPath);
    if (!token) {
      return {
        success: false,
        latencyMs,
        response: resData,
        error: `Token not found at JSON path '${tokenPath}'. Full response: ${JSON.stringify(resData)}`
      };
    }
    return {
      success: true,
      token: String(token),
      response: resData,
      latencyMs
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: `Failed to fetch access token: ${err.message}`
    };
  }
}
async function testHttpConnection(config) {
  let tokenResult = null;
  let authToken = void 0;
  const authType = config.authType || (config.tokenPath ? "oauth" : "none");
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
      tokenPath: config.tokenPath || "access_token"
    });
    if (!tokenResult.success) {
      return {
        success: false,
        type: "http",
        tokenResult,
        error: `Pre-request token fetch failed: ${tokenResult.error}`
      };
    }
    authToken = tokenResult.token;
  }
  const targetUrl = config.url;
  if (!targetUrl || targetUrl === config.tokenUrl) {
    return {
      success: true,
      type: "http",
      tokenResult,
      token: authToken,
      message: "Pre-request token fetched successfully."
    };
  }
  const startTime = Date.now();
  try {
    const headers = {
      "Accept": "application/json, text/plain, */*"
    };
    if (config.headers) {
      try {
        const parsed = typeof config.headers === "string" ? JSON.parse(config.headers) : config.headers;
        Object.assign(headers, parsed);
      } catch (e) {
        return {
          success: false,
          type: "http",
          tokenResult,
          error: `Invalid custom headers JSON: ${e.message}`
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
      const prefix = config.tokenHeaderPrefix !== void 0 ? config.tokenHeaderPrefix : "Bearer ";
      headers[headerName] = `${prefix}${authToken}`;
    }
    let resolvedUrl = targetUrl;
    if (resolvedUrl && !resolvedUrl.startsWith("http://") && !resolvedUrl.startsWith("https://")) {
      const separator = resolvedUrl.startsWith("/") ? "" : "/";
      const port = process.env.PORT || 3e3;
      resolvedUrl = `http://127.0.0.1:${port}${separator}${resolvedUrl}`;
    }
    const fetchOptions = {
      method: config.method || "GET",
      headers
    };
    if (config.caId) {
      const caCert = await getCaCertContent(config.caId);
      if (caCert || config.caId === "accept_all") {
        fetchOptions.tls = {
          ca: caCert,
          rejectUnauthorized: config.caId !== "accept_all"
        };
      }
    }
    const res = await fetch(resolvedUrl, fetchOptions);
    const latencyMs = Date.now() - startTime;
    let resData;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      resData = await res.json();
    } else {
      const text = await res.text();
      try {
        resData = JSON.parse(text);
      } catch {
        resData = text.slice(0, 1e3);
      }
    }
    const resHeaders = {};
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
      error: !res.ok ? `HTTP ${res.status}: ${typeof resData === "object" ? JSON.stringify(resData) : resData}` : void 0
    };
  } catch (err) {
    return {
      success: false,
      type: "http",
      latencyMs: Date.now() - startTime,
      tokenResult,
      error: `HTTP Request Failed: ${err.message}`
    };
  }
}
async function testGrpcConnection(config) {
  const {
    serverAddress,
    useTls,
    caId,
    acceptInvalidCert,
    metadata,
    authType
  } = config;
  if (!serverAddress) {
    return {
      success: false,
      type: "grpc",
      error: "gRPC Server address (host:port) is required."
    };
  }
  let tokenResult = null;
  let authToken = void 0;
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
      tokenPath: config.tokenPath || "access_token"
    });
    if (!tokenResult.success) {
      return {
        success: false,
        type: "grpc",
        tokenResult,
        error: `Pre-request token fetch failed: ${tokenResult.error}`
      };
    }
    authToken = tokenResult.token;
  }
  const startTime = Date.now();
  try {
    let caCert = void 0;
    if (caId) {
      caCert = await getCaCertContent(caId);
    }
    const credentials = useTls ? grpc.credentials.createSsl(caCert ? Buffer.from(caCert) : null, void 0, void 0, acceptInvalidCert || caId === "accept_all" ? {
      rejectUnauthorized: false,
      checkServerIdentity: () => void 0
    } : void 0) : grpc.credentials.createInsecure();
    const client = new grpc.Client(serverAddress, credentials);
    const deadline = new Date(Date.now() + 5e3);
    const connected = await new Promise((resolve) => {
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
        error: `Failed to establish connection to gRPC server at ${serverAddress} within 5s timeout.`
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
      message: `Successfully connected to gRPC server at ${serverAddress}${useTls ? " (TLS)" : " (Insecure)"}.`
    };
  } catch (err) {
    return {
      success: false,
      type: "grpc",
      serverAddress,
      latencyMs: Date.now() - startTime,
      tokenResult,
      error: `gRPC Connection Error: ${err.message}`
    };
  }
}
async function testSurrealDbConnection(config) {
  const {
    url,
    username,
    password,
    namespace,
    database
  } = config;
  if (!url) {
    return {
      success: false,
      type: "surrealdb",
      error: "SurrealDB endpoint URL is required."
    };
  }
  const startTime = Date.now();
  try {
    const s = new Surreal();
    if (username || password) {
      await s.connect(url, {
        authentication: {
          username: username || "root",
          password: password || ""
        }
      });
    } else {
      await s.connect(url);
    }
    if (namespace) {
      await s.use({
        namespace,
        database: database || void 0
      });
    }
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
      message: `Successfully connected to SurrealDB at ${url} (NS: ${namespace || "default"}, DB: ${database || "default"}).`
    };
  } catch (err) {
    return {
      success: false,
      type: "surrealdb",
      url,
      latencyMs: Date.now() - startTime,
      error: `SurrealDB Connection Failed: ${err.message}`
    };
  }
}
export {
  testSurrealDbConnection as a,
  testHttpConnection as b,
  fetchPreRequestToken as f,
  normalizeConnection as n,
  testGrpcConnection as t
};
//# sourceMappingURL=connections-BimqTFQY.js.map
