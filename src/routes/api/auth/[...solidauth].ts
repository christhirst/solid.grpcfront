import { SolidAuth, type SolidAuthConfig } from "@auth/solid-start";
import { logger } from "~/lib/logger";

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
      checks: ["pkce", "state"],
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username || profile.email || profile.sub,
          email: profile.email,
          image: profile.picture || profile.profile_picture,
        };
      },
    } as any,
  ],
  callbacks: {
    async jwt({ token, user, profile }) {
      if (user) {
        token.sub = user.id || (profile as any)?.sub || token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).sub = token.sub;
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
  const url = event.request.url;
  debugLog(`[auth][api-debug] GET request URL: ${url}`);
  const res = await authGET(event);
  return res;
};

export const POST = async (event: any) => {
  const url = event.request?.url;
  debugLog(`[auth][api-debug] POST request URL: ${url}`);
  return await authPOST(event);
};

