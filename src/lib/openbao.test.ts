import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { randomBytes } from "node:crypto";
import {
  parseVaultSecretRef,
  isVaultSecretRef,
  formatVaultSecretRef,
  getCredentialSecuritySummary,
  offloadSecretsToOpenBao,
  resolveObjectSecrets,
  readVaultSecret,
  getOpenBaoStatus,
  clearOpenBaoCaches,
} from "./openbao";
import { normalizeConnection } from "./connections";
import { encryptRecordSecrets, clearMasterKeyringCache } from "./crypto/envelope";
import { MASKED_SECRET_PLACEHOLDER } from "./vaultRef";

describe("OpenBao Credential Storage & Security", () => {
  let mockServer: any;
  let mockVaultUrl = "";
  const kvStore = new Map<string, Record<string, string>>();

  beforeAll(() => {
    mockServer = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        const token = req.headers.get("X-Vault-Token");

        if (url.pathname === "/v1/sys/health") {
          return Response.json({
            initialized: true,
            sealed: false,
            version: "2.1.0-openbao",
          });
        }

        if (token !== "test-bao-token") {
          return new Response("permission denied", { status: 403 });
        }

        if (url.pathname === "/v1/auth/token/lookup-self") {
          return Response.json({ data: { id: "test-bao-token", policies: ["default"] } });
        }

        const kvMatch = url.pathname.match(/^\/v1\/([^/]+)\/data\/(.+)$/);
        if (kvMatch) {
          const [, mount, path] = kvMatch;
          const key = `${mount}/${path}`;
          if (req.method === "GET") {
            const existing = kvStore.get(key);
            if (!existing) return new Response("not found", { status: 404 });
            return Response.json({ data: { data: existing } });
          }
          if (req.method === "POST") {
            const body: any = await req.json();
            kvStore.set(key, body.data || {});
            return Response.json({ data: { version: 1 } });
          }
        }

        return new Response("not found", { status: 404 });
      },
    });
    mockVaultUrl = `http://127.0.0.1:${mockServer.port}`;
  });

  afterAll(() => {
    mockServer?.stop(true);
  });

  test("parses bao: and vaultSecret() references accurately", () => {
    const ref1 = parseVaultSecretRef("bao:secret/solidflow/connections/c1#password");
    expect(ref1).toEqual({
      mount: "secret",
      path: "solidflow/connections/c1",
      key: "password",
      raw: "bao:secret/solidflow/connections/c1#password",
    });

    const ref2 = parseVaultSecretRef('vaultSecret("secret/ferriskey#client_secret")');
    expect(ref2).toEqual({
      mount: "secret",
      path: "ferriskey",
      key: "client_secret",
      raw: 'vaultSecret("secret/ferriskey#client_secret")',
    });

    expect(isVaultSecretRef("bao:secret/app#token")).toBe(true);
    expect(isVaultSecretRef("my-plaintext-password")).toBe(false);
    expect(formatVaultSecretRef("secret", "solidflow/connections/123", "bearerToken")).toBe(
      "bao:secret/solidflow/connections/123#bearerToken"
    );
  });

  test("classifies connection credential security (openbao vs cleartext vs mixed vs none)", () => {
    const safeConn = normalizeConnection({
      id: "connection:1",
      name: "Safe API",
      type: "http",
      url: "https://api.example.com",
      authType: "basic",
      username: "admin",
      password: "bao:secret/solidflow/connections/1#password",
    });
    expect(safeConn.credentialSecurity).toBe("openbao");
    expect(safeConn.secretStorage).toBe("openbao");

    const unsafeConn = normalizeConnection({
      id: "connection:2",
      name: "Unsafe API",
      type: "http",
      url: "https://api.example.com",
      authType: "basic",
      username: "admin",
      password: "plaintext-password-123",
    });
    expect(unsafeConn.credentialSecurity).toBe("cleartext");
    expect(unsafeConn.secretStorage).toBe("db");

    const mixedSummary = getCredentialSecuritySummary({
      password: "bao:secret/solidflow/connections/3#password",
      tokenClientSecret: "plaintext-secret",
    });
    expect(mixedSummary.status).toBe("mixed");
  });

  test("verifies OpenBao status, offloads secrets, and resolves them in-memory at runtime", async () => {
    clearOpenBaoCaches();
    const cfgOverride = {
      url: mockVaultUrl,
      token: "test-bao-token",
      mount: "secret",
    };

    const status = await getOpenBaoStatus(cfgOverride);
    expect(status.connected).toBe(true);
    expect(status.version).toBe("2.1.0-openbao");

    const rawConnection = {
      name: "Prod OAuth API",
      type: "http",
      url: "https://api.prod.internal",
      authType: "oauth",
      password: "super-secret-basic-pass",
      tokenPassword: "super-secret-oauth-pass",
      tokenClientSecret: "super-secret-client-secret",
    };

    const offloaded = await offloadSecretsToOpenBao(
      "solidflow/connections/prod1",
      rawConnection,
      null,
      undefined,
      cfgOverride
    );

    // SurrealDB payload only has bao:... references, never plaintext secrets
    expect(offloaded.password).toBe("bao:secret/solidflow/connections/prod1#password");
    expect(offloaded.tokenPassword).toBe("bao:secret/solidflow/connections/prod1#tokenPassword");
    expect(offloaded.tokenClientSecret).toBe("bao:secret/solidflow/connections/prod1#tokenClientSecret");

    // Resolve single secret
    const singleVal = await readVaultSecret(offloaded.password, cfgOverride);
    expect(singleVal).toBe("super-secret-basic-pass");

    // Resolve entire object in-memory before request execution
    const resolved = await resolveObjectSecrets(offloaded, undefined, cfgOverride);
    expect(resolved.password).toBe("super-secret-basic-pass");
    expect(resolved.tokenPassword).toBe("super-secret-oauth-pass");
    expect(resolved.tokenClientSecret).toBe("super-secret-client-secret");
  });

  test("resolves AES-256-GCM DB secrets transparently and decrypts before migrating to OpenBao", async () => {
    clearOpenBaoCaches();
    const prevKey = process.env.ENCRYPTION_MASTER_KEY_V1;
    const prevActive = process.env.ENCRYPTION_ACTIVE_KEY_VERSION;
    process.env.ENCRYPTION_MASTER_KEY_V1 = randomBytes(32).toString("base64");
    process.env.ENCRYPTION_ACTIVE_KEY_VERSION = "v1";
    clearMasterKeyringCache();

    try {
      const cfgOverride = {
        url: mockVaultUrl,
        token: "test-bao-token",
        mount: "secret",
      };

      const encryptedDbConn = encryptRecordSecrets("connection:enc-to-bao", {
        id: "connection:enc-to-bao",
        name: "Encrypted DB Conn",
        type: "http",
        url: "https://api.internal",
        authType: "oauth",
        password: "real-basic-password",
        tokenClientSecret: "real-oauth-client-secret",
      });

      expect(normalizeConnection(encryptedDbConn).credentialSecurity).toBe("encrypted");

      // Executors calling resolveObjectSecrets get plaintext in-memory
      const resolved = await resolveObjectSecrets(encryptedDbConn, undefined, cfgOverride);
      expect(resolved.password).toBe("real-basic-password");
      expect(resolved.tokenClientSecret).toBe("real-oauth-client-secret");

      // Migrating from encrypted DB to OpenBao (with masked UI fields) writes REAL plaintext to OpenBao
      const migrated = await offloadSecretsToOpenBao(
        "solidflow/connections/enc-to-bao",
        {
          ...encryptedDbConn,
          password: MASKED_SECRET_PLACEHOLDER,
          tokenClientSecret: MASKED_SECRET_PLACEHOLDER,
          secretStorage: "openbao",
        },
        encryptedDbConn,
        undefined,
        cfgOverride
      );

      expect(migrated.password).toBe("bao:secret/solidflow/connections/enc-to-bao#password");
      expect(migrated.tokenClientSecret).toBe(
        "bao:secret/solidflow/connections/enc-to-bao#tokenClientSecret"
      );
      expect(migrated.encrypted_dek).toBeUndefined();
      expect(migrated.key_version).toBeUndefined();

      const baoPassword = await readVaultSecret(migrated.password, cfgOverride);
      const baoSecret = await readVaultSecret(migrated.tokenClientSecret, cfgOverride);
      expect(baoPassword).toBe("real-basic-password");
      expect(baoSecret).toBe("real-oauth-client-secret");
    } finally {
      if (prevKey === undefined) delete process.env.ENCRYPTION_MASTER_KEY_V1;
      else process.env.ENCRYPTION_MASTER_KEY_V1 = prevKey;
      if (prevActive === undefined) delete process.env.ENCRYPTION_ACTIVE_KEY_VERSION;
      else process.env.ENCRYPTION_ACTIVE_KEY_VERSION = prevActive;
      clearMasterKeyringCache();
    }
  });
});
