import { logger } from "./logger";

export const DEFAULT_OIDC_REDIRECT_URI =
  process.env.OIDC_REDIRECT_URI ||
  "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/";

/**
 * Safely extracts a header value from Headers instance or plain object.
 */
export function getHeader(headers: any, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof headers.get === "function") {
    return headers.get(name) || undefined;
  }
  const lower = name.toLowerCase();
  return headers[lower] || headers[name] || undefined;
}

/**
 * Derives the dynamic origin (protocol + host[:port]) from request headers or configured env vars.
 */
export function getDynamicOrigin(request: Request | any): string {
  const headers = request?.headers;
  const forwardedProto = getHeader(headers, "x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = getHeader(headers, "x-forwarded-host")?.split(",")[0]?.trim();
  const rawHost = getHeader(headers, "host")?.split(",")[0]?.trim();
  const originHeader = getHeader(headers, "origin");
  const refererHeader = getHeader(headers, "referer");

  // Determine protocol
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

  // 1. Check if X-Forwarded-Host is provided (standard behind reverse proxies/ingress)
  if (forwardedHost) {
    return `${proto}://${forwardedHost}`;
  }

  // 2. Check Origin header (e.g. from POST/fetch signin requests)
  if (originHeader) {
    try {
      const u = new URL(originHeader);
      if (!isInternalHost(u.hostname)) {
        return u.origin;
      }
    } catch {}
  }

  // 3. Check Referer header origin
  if (refererHeader) {
    try {
      const u = new URL(refererHeader);
      if (!isInternalHost(u.hostname)) {
        return u.origin;
      }
    } catch {}
  }

  // 4. Check standard Host header if not internal localhost/0.0.0.0
  if (rawHost && !isInternalHost(rawHost)) {
    return `${proto}://${rawHost}`;
  }

  // 5. Configured OIDC_REDIRECT_URI default/override
  const oidcRedirect = process.env.OIDC_REDIRECT_URI || DEFAULT_OIDC_REDIRECT_URI;
  if (oidcRedirect) {
    try {
      return new URL(oidcRedirect).origin;
    } catch {
      return oidcRedirect.replace(/\/$/, "");
    }
  }

  // 6. Configured APP_ORIGIN fallback
  if (process.env.APP_ORIGIN) {
    return process.env.APP_ORIGIN.replace(/\/$/, "");
  }

  // 7. Configured AUTH_URL / NEXTAUTH_URL fallback
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (authUrl) {
    try {
      return new URL(authUrl).origin;
    } catch {}
  }

  // 8. If rawHost is localhost / internal and no external env set, allow it for local dev
  if (rawHost) {
    return `${proto || "http"}://${rawHost}`;
  }

  if (typeof request?.url === "string") {
    try {
      return new URL(request.url).origin;
    } catch {}
  }

  return "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com";
}

function isInternalHost(hostWithPort: string): boolean {
  const host = hostWithPort.split(":")[0].toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "solid-grpcfront"
  );
}

/**
 * Creates a cloned Request with URL rewritten to the dynamic origin.
 * Preserves method, headers, and body.
 */
export function createDynamicRequest(request: Request | any): { request: Request; dynamicUrl: string } {
  if (!request) return { request, dynamicUrl: "" };

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
    const reqInit: RequestInit & { duplex?: string } = {
      method: request.method,
      headers: request.headers,
    };

    if (isPost && request.body) {
      reqInit.body = request.body;
      reqInit.duplex = "half";
    }

    const dynamicReq = new Request(dynamicUrl, reqInit);
    return { request: dynamicReq, dynamicUrl };
  } catch (err) {
    logger.warn(`[authUrl] Failed to clone Request with dynamic URL: ${err}, using original`);
    return { request, dynamicUrl };
  }
}
