import { SolidAuth, getSession } from "@auth/solid-start";
import { customFetch } from "@auth/core";
import { l as logger } from "./logger-BDLv3oYI.js";
const oidcIssuer = process.env.OIDC_ISSUER || "https://oauth.wiremockapi.cloud";
const baseIssuer = oidcIssuer.replace(/\/$/, "");
const debugLog = (...args) => {
  logger.debug(...args);
};
const authorizationUrl = `${baseIssuer}/authorize`;
const tokenUrl = baseIssuer.includes("oidc-tester.compile7.org") ? `${baseIssuer.replace("/app/", "/api/app/")}/token` : `${baseIssuer}/token`;
const userinfoUrl = baseIssuer.includes("oidc-tester.compile7.org") ? `${baseIssuer.replace("/app/", "/api/app/")}/userinfo` : `${baseIssuer}/userinfo`;
const customFetchInterceptor = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  debugLog(`[auth][debug] customFetch request: ${url}`);
  if (url.includes("/token")) {
    const response = await fetch(input, init);
    debugLog(`[auth][debug] /token response status: ${response.status}`);
    if (response.ok) {
      try {
        const clone = response.clone();
        const body = await clone.json();
        debugLog(`[auth][debug] /token response body keys:`, Object.keys(body));
        let modified = false;
        if (body && body.id_token) {
          body.access_token = body.access_token || body.id_token;
          body.token_type = body.token_type || "Bearer";
          delete body.id_token;
          modified = true;
        }
        if (modified) {
          debugLog(`[auth][debug] /token response patched! keys:`, Object.keys(body));
          return new Response(JSON.stringify(body), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }
      } catch (e) {
        console.error("[auth] Error patching token response:", e);
      }
    }
    return response;
  }
  if (url.includes("/userinfo")) {
    const headers = new Headers(init?.headers);
    const authHeader = headers.get("authorization");
    const token = authHeader?.split(" ")[1];
    debugLog(`[auth][debug] /userinfo request token found: ${!!token}`);
    if (token) {
      try {
        const payloadParts = token.split(".");
        if (payloadParts.length === 3) {
          const payloadBase64 = payloadParts[1];
          const decodedPayload = Buffer.from(payloadBase64, "base64").toString("utf-8");
          const userProfile = JSON.parse(decodedPayload);
          debugLog(`[auth][debug] /userinfo decoded profile sub: ${userProfile.sub}`);
          return new Response(JSON.stringify(userProfile), {
            status: 200,
            statusText: "OK",
            headers: {
              "Content-Type": "application/json"
            }
          });
        } else {
          debugLog(`[auth][debug] /userinfo token is not a 3-part JWT`);
        }
      } catch (e) {
        console.error("[auth] Error decoding ID token in customFetch:", e);
      }
    }
  }
  return fetch(input, init);
};
const config = {
  basePath: "/api/auth",
  providers: [{
    id: "oidc",
    name: "Mock OIDC",
    type: "oauth",
    authorization: {
      url: authorizationUrl,
      params: {
        scope: "openid profile email"
      }
    },
    token: tokenUrl,
    userinfo: userinfoUrl,
    clientId: process.env.OIDC_CLIENT_ID || "mock-client-id",
    clientSecret: process.env.OIDC_CLIENT_SECRET || "mock-client-secret",
    checks: ["pkce"],
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name || `${profile.given_name} ${profile.family_name}`,
        email: profile.email,
        image: profile.profile_picture || profile.picture
      };
    },
    [customFetch]: customFetchInterceptor
  }],
  callbacks: {
    async jwt({
      token,
      user
    }) {
      if (user) {
        token.sub = user.id;
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
  secret: process.env.AUTH_SECRET || "super-secret-fallback-key-for-dev"
};
const authOpts = config;
const {
  GET: authGET,
  POST: authPOST
} = SolidAuth(config);
async function getAuthUser(request) {
  try {
    const session = await getSession(request, authOpts);
    if (!session?.user) return null;
    const user = session.user;
    return {
      sub: user.sub || user.id || "anonymous",
      name: user.name || void 0,
      email: user.email || void 0,
      image: user.image || void 0
    };
  } catch {
    return null;
  }
}
async function getOwnerFromRequest(request) {
  const user = await getAuthUser(request);
  return user?.sub || "anonymous";
}
export {
  getOwnerFromRequest as g
};
//# sourceMappingURL=auth-BNAJzjej.js.map
