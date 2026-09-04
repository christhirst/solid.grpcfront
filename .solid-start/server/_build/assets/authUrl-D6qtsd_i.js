import { l as logger } from "./logger-BDLv3oYI.js";
const DEFAULT_OIDC_REDIRECT_URI = process.env.OIDC_REDIRECT_URI || "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/";
function getHeader(headers, name) {
  if (!headers) return void 0;
  if (typeof headers.get === "function") {
    return headers.get(name) || void 0;
  }
  const lower = name.toLowerCase();
  return headers[lower] || headers[name] || void 0;
}
function getDynamicOrigin(request) {
  const headers = request?.headers;
  const forwardedProto = getHeader(headers, "x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = getHeader(headers, "x-forwarded-host")?.split(",")[0]?.trim();
  const rawHost = getHeader(headers, "host")?.split(",")[0]?.trim();
  const originHeader = getHeader(headers, "origin");
  const refererHeader = getHeader(headers, "referer");
  let proto = forwardedProto;
  if (!proto) {
    if (originHeader?.startsWith("https://") || refererHeader?.startsWith("https://")) {
      proto = "https";
    } else if (typeof request?.url === "string" && request.url.startsWith("https://")) {
      proto = "https";
    } else {
      proto = "https";
    }
  }
  if (forwardedHost) {
    return `${proto}://${forwardedHost}`;
  }
  if (originHeader) {
    try {
      const u = new URL(originHeader);
      if (!isInternalHost(u.hostname)) {
        return u.origin;
      }
    } catch {
    }
  }
  if (refererHeader) {
    try {
      const u = new URL(refererHeader);
      if (!isInternalHost(u.hostname)) {
        return u.origin;
      }
    } catch {
    }
  }
  if (rawHost && !isInternalHost(rawHost)) {
    return `${proto}://${rawHost}`;
  }
  const oidcRedirect = process.env.OIDC_REDIRECT_URI || DEFAULT_OIDC_REDIRECT_URI;
  {
    try {
      return new URL(oidcRedirect).origin;
    } catch {
      return oidcRedirect.replace(/\/$/, "");
    }
  }
  if (process.env.APP_ORIGIN) {
    return process.env.APP_ORIGIN.replace(/\/$/, "");
  }
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (authUrl) {
    try {
      return new URL(authUrl).origin;
    } catch {
    }
  }
  if (rawHost) {
    return `${proto || "http"}://${rawHost}`;
  }
  if (typeof request?.url === "string") {
    try {
      return new URL(request.url).origin;
    } catch {
    }
  }
  return "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com";
}
function isInternalHost(hostWithPort) {
  const host = hostWithPort.split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host === "solid-grpcfront";
}
function createDynamicRequest(request) {
  if (!request) return {
    request,
    dynamicUrl: ""
  };
  const dynamicOrigin = getDynamicOrigin(request);
  let pathnameAndSearch = "/";
  if (typeof request.url === "string") {
    try {
      const parsed = new URL(request.url, dynamicOrigin);
      pathnameAndSearch = `${parsed.pathname}${parsed.search}`;
    } catch {
      pathnameAndSearch = request.url.startsWith("/") ? request.url : `/${request.url}`;
    }
  }
  const dynamicUrl = `${dynamicOrigin}${pathnameAndSearch}`;
  try {
    const isPost = request.method === "POST" || request.method === "PUT" || request.method === "PATCH";
    const reqInit = {
      method: request.method,
      headers: request.headers
    };
    if (isPost && request.body) {
      reqInit.body = request.body;
      reqInit.duplex = "half";
    }
    const dynamicReq = new Request(dynamicUrl, reqInit);
    return {
      request: dynamicReq,
      dynamicUrl
    };
  } catch (err) {
    logger.warn(`[authUrl] Failed to clone Request with dynamic URL: ${err}, using original`);
    return {
      request,
      dynamicUrl
    };
  }
}
export {
  createDynamicRequest as c
};
//# sourceMappingURL=authUrl-D6qtsd_i.js.map
