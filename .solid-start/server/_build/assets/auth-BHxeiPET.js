import { SolidAuth, getSession } from "@auth/solid-start";
import "./logger-BDLv3oYI.js";
const oidcIssuer = process.env.OIDC_ISSUER || "https://auth.401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/api/realms/master";
const clientId = process.env.OIDC_CLIENT_ID || process.env.AUTH_CLIENT_NAME || process.env["AUTH_CLIENT-NAME"] || "solid-grpcfront";
const clientSecret = process.env.OIDC_CLIENT_SECRET || process.env.AUTH_SECRET || "JhWziCfG2qCmYPCT";
const authSecret = process.env.AUTH_SECRET || "JhWziCfG2qCmYPCT";
const config = {
  basePath: "/api/auth",
  providers: [{
    id: "oidc",
    name: "FerrisKey",
    type: "oidc",
    issuer: oidcIssuer,
    clientId,
    clientSecret,
    checks: ["pkce", "state"],
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
//# sourceMappingURL=auth-BHxeiPET.js.map
