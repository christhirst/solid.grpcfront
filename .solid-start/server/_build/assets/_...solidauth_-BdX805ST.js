import { SolidAuth } from "@auth/solid-start";
import { l as logger } from "./logger-BDLv3oYI.js";
import { c as createDynamicRequest } from "./authUrl-D6qtsd_i.js";
const oidcIssuer = process.env.OIDC_ISSUER || "https://auth.401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/api/realms/master";
const clientId = process.env.OIDC_CLIENT_ID || process.env.AUTH_CLIENT_NAME || process.env["AUTH_CLIENT-NAME"] || "solid-grpcfront";
const clientSecret = process.env.OIDC_CLIENT_SECRET || process.env.AUTH_SECRET || "JhWziCfG2qCmYPCT";
const authSecret = process.env.AUTH_SECRET || "JhWziCfG2qCmYPCT";
const debugLog = (...args) => {
  logger.debug(...args);
};
const config = {
  basePath: "/api/auth",
  providers: [{
    id: "oidc",
    name: "FerrisKey",
    type: "oidc",
    issuer: oidcIssuer,
    clientId,
    clientSecret,
    checks: ["pkce"],
    client: {
      token_endpoint_auth_method: "client_secret_post"
    },
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name || profile.preferred_username || profile.email || profile.sub,
        email: profile.email,
        image: profile.picture || profile.profile_picture
      };
    }
  }],
  callbacks: {
    async redirect({
      url,
      baseUrl
    }) {
      debugLog(`[auth][redirect] Target URL: ${url}, BaseURL: ${baseUrl}`);
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      try {
        const urlOrigin = new URL(url).origin;
        const baseOrigin = new URL(baseUrl).origin;
        if (urlOrigin === baseOrigin) {
          return url;
        }
      } catch {
      }
      return baseUrl;
    },
    async jwt({
      token,
      user,
      profile
    }) {
      if (user) {
        token.sub = user.id || profile?.sub || token.sub;
      }
      return token;
    },
    async session({
      session,
      token
    }) {
      if (session.user) {
        session.user.sub = token.sub;
      }
      return session;
    }
  },
  trustHost: true,
  secret: authSecret
};
const {
  GET: authGET
} = SolidAuth(config);
const GET = async (event) => {
  const {
    request: dynamicReq,
    dynamicUrl
  } = createDynamicRequest(event.request);
  debugLog(`[auth][api-debug] GET original URL: ${event.request?.url} -> dynamic URL: ${dynamicUrl}`);
  const dynamicEvent = {
    ...event,
    request: dynamicReq
  };
  const res = await authGET(dynamicEvent);
  debugLog(`[auth][api-debug] GET response status: ${res?.status}`);
  return res;
};
export {
  GET
};
//# sourceMappingURL=_...solidauth_-BdX805ST.js.map
