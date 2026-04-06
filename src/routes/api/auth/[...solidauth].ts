import { SolidAuth, type SolidAuthConfig } from "@auth/solid-start";
import type { OIDCConfig } from "@auth/core/providers";

const config: SolidAuthConfig = {
  basePath: "/api/auth",
  providers: [
    {
      id: "oidc",
      name: "Mock OIDC",
      type: "oidc",
      issuer: process.env.OIDC_ISSUER || "https://oauth.wiremockapi.cloud",
      clientId: process.env.OIDC_CLIENT_ID || "mock-client-id",
      clientSecret: process.env.OIDC_CLIENT_SECRET || "mock-client-secret",
      checks: ["pkce"],
    } as OIDCConfig<any>,
  ],
  trustHost: true,
  secret: process.env.AUTH_SECRET || "super-secret-fallback-key-for-dev",
};

export const authOpts = config;
export const { GET, POST } = SolidAuth(config);
