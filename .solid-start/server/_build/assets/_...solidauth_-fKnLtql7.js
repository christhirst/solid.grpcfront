import { SolidAuth } from "@auth/solid-start";
const config = {
  basePath: "/api/auth",
  providers: [{
    id: "oidc",
    name: "Mock OIDC",
    type: "oidc",
    issuer: process.env.OIDC_ISSUER || "https://oauth.wiremockapi.cloud",
    clientId: process.env.OIDC_CLIENT_ID || "mock-client-id",
    clientSecret: process.env.OIDC_CLIENT_SECRET || "mock-client-secret",
    checks: ["pkce"]
  }],
  trustHost: true,
  secret: process.env.AUTH_SECRET || "super-secret-fallback-key-for-dev"
};
const {
  GET,
  POST
} = SolidAuth(config);
export {
  GET,
  POST
};
//# sourceMappingURL=_...solidauth_-fKnLtql7.js.map
