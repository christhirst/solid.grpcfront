import { SolidAuth, type SolidAuthConfig } from "@auth/solid-start";
import { logger } from "~/lib/logger";
import { createDynamicRequest } from "~/lib/authUrl";
import { decodeJwtHeaderSafe, decodeJwtPayloadSafe, extractClaimsFromOidcPayload } from "~/lib/groupAuth";

const oidcIssuer = process.env.OIDC_ISSUER || "https://auth.401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/api/realms/master";
const clientId = process.env.OIDC_CLIENT_ID || process.env.AUTH_CLIENT_NAME || process.env["AUTH_CLIENT-NAME"] || "solid-grpcfront";
const clientSecret = process.env.OIDC_CLIENT_SECRET || process.env.AUTH_SECRET || "JhWziCfG2qCmYPCT";
const authSecret = process.env.AUTH_SECRET || "JhWziCfG2qCmYPCT";

const debugLog = (...args: any[]) => {
  logger.debug(...args);
};

const config: SolidAuthConfig = {
  basePath: "/api/auth",
  providers: [
    {
      id: "oidc",
      name: "FerrisKey",
      type: "oidc",
      issuer: oidcIssuer,
      clientId: clientId,
      clientSecret: clientSecret,
      checks: ["pkce"],
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      profile(profile: any) {
        const idpGroups = extractClaimsFromOidcPayload(profile, clientId);
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username || profile.email || profile.sub,
          username: profile.preferred_username || profile.username || profile.name || profile.email || profile.sub,
          email: profile.email,
          image: profile.picture || profile.profile_picture,
          idpGroups,
          rawProfile: profile,
        };
      },
    } as any,
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
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
      } catch {}
      return baseUrl;
    },
    async jwt({ token, user, profile, account }) {
      if (user) {
        token.sub = user.id || (profile as any)?.sub || token.sub;
        token.username = (user as any).username || (profile as any)?.preferred_username || user.name || token.username;
      }
      if (!token.sessionId) {
        token.sessionId = crypto.randomUUID();
      }
      if (user || profile || account) {
        const claimSet = new Set<string>();
        for (const c of ((user as any)?.idpGroups as string[]) || []) {
          claimSet.add(c);
        }
        for (const c of extractClaimsFromOidcPayload(profile as any, clientId)) {
          claimSet.add(c);
        }
        const idPayload = decodeJwtPayloadSafe((account as any)?.id_token);
        const idHeader = decodeJwtHeaderSafe((account as any)?.id_token);
        for (const c of extractClaimsFromOidcPayload(idPayload, clientId)) {
          claimSet.add(c);
        }
        const accessPayload = decodeJwtPayloadSafe((account as any)?.access_token);
        const accessHeader = decodeJwtHeaderSafe((account as any)?.access_token);
        for (const c of extractClaimsFromOidcPayload(accessPayload, clientId)) {
          claimSet.add(c);
        }
        token.idpGroups = [...claimSet];

        // Merge all decoded claims into token.jwtClaims for user inspection
        const combinedClaims: Record<string, any> = {
          ...(token.jwtClaims as Record<string, any> || {}),
        };
        const rawProf = (user as any)?.rawProfile || (profile as any);
        if (rawProf && typeof rawProf === "object") {
          Object.assign(combinedClaims, rawProf);
        }
        if (idPayload) {
          Object.assign(combinedClaims, idPayload);
        }
        if (accessPayload) {
          for (const [k, v] of Object.entries(accessPayload)) {
            if (!(k in combinedClaims)) {
              combinedClaims[k] = v;
            }
          }
        }
        if (Object.keys(combinedClaims).length > 0) {
          token.jwtClaims = combinedClaims;
        }
        if (idHeader) {
          token.jwtHeader = idHeader;
        } else if (accessHeader && !token.jwtHeader) {
          token.jwtHeader = accessHeader;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).sub = token.sub;
        (session.user as any).username = token.username || session.user.name || token.sub;
        (session.user as any).idpGroups = Array.isArray(token.idpGroups) ? token.idpGroups : [];
        (session.user as any).sessionId = token.sessionId;
        (session.user as any).jwtClaims = (token.jwtClaims as Record<string, any>) || null;
        (session.user as any).jwtHeader = (token.jwtHeader as Record<string, any>) || null;
      }
      return session;
    },
  },
  trustHost: true,
  secret: authSecret,
};

export const authOpts = config;

const { GET: authGET, POST: authPOST } = SolidAuth(config);

export const GET = async (event: any) => {
  const { request: dynamicReq, dynamicUrl } = createDynamicRequest(event.request);
  debugLog(`[auth][api-debug] GET original URL: ${event.request?.url} -> dynamic URL: ${dynamicUrl}`);
  const dynamicEvent = { ...event, request: dynamicReq };
  const res = await authGET(dynamicEvent);
  debugLog(`[auth][api-debug] GET response status: ${res?.status}`);
  return res;
};

export const POST = async (event: any) => {
  const { request: dynamicReq, dynamicUrl } = createDynamicRequest(event.request);
  debugLog(`[auth][api-debug] POST original URL: ${event.request?.url} -> dynamic URL: ${dynamicUrl}`);
  const dynamicEvent = { ...event, request: dynamicReq };
  const res = await authPOST(dynamicEvent);
  debugLog(`[auth][api-debug] POST response status: ${res?.status}`);
  return res;
};
