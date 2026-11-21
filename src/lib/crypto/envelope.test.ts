import { describe, expect, test, afterEach } from "bun:test";
import { randomBytes } from "node:crypto";
import {
  canonicalizeRecordId,
  clearMasterKeyringCache,
  decodeKeyMaterial,
  decryptRecordSecrets,
  encryptRecordSecrets,
  generateMasterKeyBase64,
  getEncryptionStatus,
  loadMasterKeyring,
  mergeMaskedConnectionSecrets,
  rotateRecordEnvelope,
  sanitizeConnectionForClient,
} from "./envelope";
import {
  getEncryptionInventory,
  rotateEncryptionKeys,
} from "./rotation";
import {
  CONNECTION_SECRET_FIELDS,
  MASKED_SECRET_PLACEHOLDER,
  getCredentialSecuritySummary,
  isEncryptedSecretValue,
  isWrappedDekValue,
} from "~/lib/vaultRef";

function makeKeyBase64(): string {
  return randomBytes(32).toString("base64");
}

function makeKeyHex(): string {
  return randomBytes(32).toString("hex");
}

function tamperSegment(encoded: string, segmentIndex: 2 | 3 | 4): string {
  const parts = encoded.split(":");
  const raw = Buffer.from(parts[segmentIndex], "base64url");
  raw[0] ^= 0xff;
  parts[segmentIndex] = raw.toString("base64url");
  return parts.join(":");
}

const originalEnvSnapshot = {
  ENCRYPTION_ACTIVE_KEY_VERSION: process.env.ENCRYPTION_ACTIVE_KEY_VERSION,
  ENCRYPTION_MASTER_KEYS: process.env.ENCRYPTION_MASTER_KEYS,
  ENCRYPTION_MASTER_KEY_V1: process.env.ENCRYPTION_MASTER_KEY_V1,
  ENCRYPTION_MASTER_KEY_V2: process.env.ENCRYPTION_MASTER_KEY_V2,
  ALLOW_CLEARTEXT_DB_SECRETS: process.env.ALLOW_CLEARTEXT_DB_SECRETS,
};

afterEach(() => {
  for (const [k, v] of Object.entries(originalEnvSnapshot)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  clearMasterKeyringCache();
});

describe("Envelope Encryption & Key Rotation (AES-256-GCM)", () => {
  test("parses versioned keys, keyring CSV & JSON strings, and rejects invalid key material", () => {
    const k1 = makeKeyBase64();
    const k2 = makeKeyHex();

    const ringFromVars = loadMasterKeyring({
      ENCRYPTION_MASTER_KEY_V1: k1,
      ENCRYPTION_MASTER_KEY_V2: k2,
      ENCRYPTION_ACTIVE_KEY_VERSION: "v2",
    });
    expect(ringFromVars).not.toBeNull();
    expect(ringFromVars!.activeVersion).toBe("v2");
    expect(ringFromVars!.versions).toEqual(["v1", "v2"]);

    const ringFromCsv = loadMasterKeyring({
      ENCRYPTION_MASTER_KEYS: `v1:${k1},v2:${k2}`,
      ENCRYPTION_ACTIVE_KEY_VERSION: "v1",
    });
    expect(ringFromCsv!.activeVersion).toBe("v1");
    expect(ringFromCsv!.versions).toEqual(["v1", "v2"]);

    const ringFromJson = loadMasterKeyring({
      ENCRYPTION_MASTER_KEYS: JSON.stringify({ v1: k1, v2: k2 }),
    });
    expect(ringFromJson!.activeVersion).toBe("v2");

    // 16-byte key must be rejected
    const shortKey = randomBytes(16).toString("base64");
    expect(() => decodeKeyMaterial(shortKey, "short")).toThrow(/expected 32 bytes/);
    expect(() => decodeKeyMaterial("not!valid!base64!", "bad")).toThrow();

    // Missing active version must fail cleanly
    const statusMissingActive = getEncryptionStatus({
      ENCRYPTION_MASTER_KEY_V1: k1,
      ENCRYPTION_ACTIVE_KEY_VERSION: "v9",
    });
    expect(statusMissingActive.configured).toBe(false);
    expect(statusMissingActive.error).toContain("v9");

    // Generated key is valid 32 bytes
    const generated = generateMasterKeyBase64();
    expect(decodeKeyMaterial(generated, "generated").length).toBe(32);
  });

  test("encrypts and decrypts all CONNECTION_SECRET_FIELDS + vault_config token with key_version column", () => {
    const keyring = loadMasterKeyring({
      ENCRYPTION_MASTER_KEY_V1: makeKeyBase64(),
      ENCRYPTION_ACTIVE_KEY_VERSION: "v1",
    })!;

    const rawRecord: Record<string, any> = {
      id: "connection:test-all-fields",
      name: "Full Secret Connection",
      password: "db-password-!@#",
      bearerToken: "eyJhbGciOiJIUzI1NiJ9.payload.sig",
      tokenPassword: "oauth-user-pass",
      tokenBearerToken: "oauth-static-bearer",
      tokenClientSecret: "super-client-secret",
      secretAccessKey: "aws-secret-access-key",
      sessionToken: "aws-session-token-xyz",
    };

    const encrypted = encryptRecordSecrets(
      rawRecord.id,
      rawRecord,
      null,
      CONNECTION_SECRET_FIELDS,
      keyring
    );

    expect(encrypted.key_version).toBe("v1");
    expect(isWrappedDekValue(encrypted.encrypted_dek)).toBe(true);
    for (const field of CONNECTION_SECRET_FIELDS) {
      expect(encrypted[field]).not.toBe(rawRecord[field]);
      expect(isEncryptedSecretValue(encrypted[field])).toBe(true);
    }

    const summary = getCredentialSecuritySummary(encrypted, CONNECTION_SECRET_FIELDS);
    expect(summary.status).toBe("encrypted");
    expect(summary.encryptedFields.length).toBe(CONNECTION_SECRET_FIELDS.length);
    expect(summary.cleartextFields).toEqual([]);

    const decrypted = decryptRecordSecrets(encrypted, CONNECTION_SECRET_FIELDS, keyring);
    for (const field of CONNECTION_SECRET_FIELDS) {
      expect(decrypted[field]).toBe(rawRecord[field]);
    }

    // Also test vault_config:main token encryption
    const vcEncrypted = encryptRecordSecrets(
      "vault_config:main",
      { id: "vault_config:main", url: "http://127.0.0.1:8200", token: "hvs.secret-bao-token" },
      null,
      ["token"],
      keyring
    );
    expect(vcEncrypted.key_version).toBe("v1");
    expect(isEncryptedSecretValue(vcEncrypted.token)).toBe(true);
    const vcDecrypted = decryptRecordSecrets(vcEncrypted, ["token"], keyring, "vault_config:main");
    expect(vcDecrypted.token).toBe("hvs.secret-bao-token");
  });

  test("generates a unique 12-byte IV/nonce on every single encryption", () => {
    const keyring = loadMasterKeyring({
      ENCRYPTION_MASTER_KEY_V1: makeKeyBase64(),
      ENCRYPTION_ACTIVE_KEY_VERSION: "v1",
    })!;

    const dekIvs = new Set<string>();
    const fieldIvs = new Set<string>();
    const fieldCiphertexts = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const enc = encryptRecordSecrets(
        "connection:nonce-test",
        { id: "connection:nonce-test", password: "identical-password" },
        null,
        CONNECTION_SECRET_FIELDS,
        keyring
      );
      dekIvs.add(enc.encrypted_dek!.split(":")[2]);
      fieldIvs.add(enc.password.split(":")[2]);
      fieldCiphertexts.add(enc.password);
    }

    expect(dekIvs.size).toBe(100);
    expect(fieldIvs.size).toBe(100);
    expect(fieldCiphertexts.size).toBe(100);
  });

  test("rejects ciphertext tampering, auth tag corruption, IV tampering, and cross-record/cross-field AAD swaps", () => {
    const keyring = loadMasterKeyring({
      ENCRYPTION_MASTER_KEY_V1: makeKeyBase64(),
      ENCRYPTION_ACTIVE_KEY_VERSION: "v1",
    })!;

    const conn1 = encryptRecordSecrets(
      "connection:conn-1",
      {
        id: "connection:conn-1",
        password: "conn1-secret-password",
        bearerToken: "conn1-bearer-token",
      },
      null,
      CONNECTION_SECRET_FIELDS,
      keyring
    );

    const conn2 = encryptRecordSecrets(
      "connection:conn-2",
      {
        id: "connection:conn-2",
        password: "conn2-secret-password",
      },
      null,
      CONNECTION_SECRET_FIELDS,
      keyring
    );

    // 1. Field ciphertext, auth tag, and IV bit flips must fail GCM verification
    expect(() =>
      decryptRecordSecrets(
        { ...conn1, password: tamperSegment(conn1.password, 2) },
        CONNECTION_SECRET_FIELDS,
        keyring
      )
    ).toThrow();
    expect(() =>
      decryptRecordSecrets(
        { ...conn1, password: tamperSegment(conn1.password, 3) },
        CONNECTION_SECRET_FIELDS,
        keyring
      )
    ).toThrow();
    expect(() =>
      decryptRecordSecrets(
        { ...conn1, password: tamperSegment(conn1.password, 4) },
        CONNECTION_SECRET_FIELDS,
        keyring
      )
    ).toThrow();

    // 2. Wrapped DEK tampering must fail
    expect(() =>
      decryptRecordSecrets(
        { ...conn1, encrypted_dek: tamperSegment(conn1.encrypted_dek!, 3) },
        CONNECTION_SECRET_FIELDS,
        keyring
      )
    ).toThrow();

    // 3. Cross-record copy-paste attack (moving conn2's field or DEK onto conn1) must fail AAD check
    expect(() =>
      decryptRecordSecrets(
        { ...conn1, password: conn2.password },
        CONNECTION_SECRET_FIELDS,
        keyring
      )
    ).toThrow();
    expect(() =>
      decryptRecordSecrets(
        { ...conn2, id: "connection:conn-1" },
        CONNECTION_SECRET_FIELDS,
        keyring
      )
    ).toThrow();

    // 4. Cross-field copy-paste attack within the SAME record must fail AAD check
    expect(() =>
      decryptRecordSecrets(
        { ...conn1, bearerToken: conn1.password },
        CONNECTION_SECRET_FIELDS,
        keyring
      )
    ).toThrow();

    // 5. Spoofing key_version without re-wrapping DEK must fail AAD check
    const v1v2Key = makeKeyBase64();
    const sharedDualRing = loadMasterKeyring({
      ENCRYPTION_MASTER_KEY_V1: v1v2Key,
      ENCRYPTION_MASTER_KEY_V2: makeKeyBase64(),
    })!;
    const v1Enc = encryptRecordSecrets(
      "connection:ver-test",
      { id: "connection:ver-test", password: "secret" },
      null,
      CONNECTION_SECRET_FIELDS,
      loadMasterKeyring({ ENCRYPTION_MASTER_KEY_V1: v1v2Key })!
    );
    expect(() =>
      decryptRecordSecrets(
        { ...v1Enc, key_version: "v2" },
        CONNECTION_SECRET_FIELDS,
        sharedDualRing
      )
    ).toThrow();
  });

  test("rotates master keys v1 -> v2 (both rewrap and reencrypt modes) and retires v1 safely", () => {
    const k1 = makeKeyBase64();
    const k2 = makeKeyBase64();

    const ringV1 = loadMasterKeyring({
      ENCRYPTION_MASTER_KEY_V1: k1,
      ENCRYPTION_ACTIVE_KEY_VERSION: "v1",
    })!;

    const ringDual = loadMasterKeyring({
      ENCRYPTION_MASTER_KEY_V1: k1,
      ENCRYPTION_MASTER_KEY_V2: k2,
      ENCRYPTION_ACTIVE_KEY_VERSION: "v2",
    })!;

    const ringV2Only = loadMasterKeyring({
      ENCRYPTION_MASTER_KEY_V2: k2,
      ENCRYPTION_ACTIVE_KEY_VERSION: "v2",
    })!;

    const original = {
      id: "connection:rotate-me",
      password: "rotate-db-password",
      tokenClientSecret: "rotate-oauth-secret",
    };

    const encryptedV1 = encryptRecordSecrets(
      original.id,
      original,
      null,
      CONNECTION_SECRET_FIELDS,
      ringV1
    );
    expect(encryptedV1.key_version).toBe("v1");

    // Existing v1 record decrypts under dual [v1, v2] keyring
    const decUnderDual = decryptRecordSecrets(encryptedV1, CONNECTION_SECRET_FIELDS, ringDual);
    expect(decUnderDual.password).toBe("rotate-db-password");

    // 1. Fast rotation (rewrap)
    const rewrapRes = rotateRecordEnvelope(encryptedV1, {
      mode: "rewrap",
      keyringOverride: ringDual,
    });
    expect(rewrapRes.changed).toBe(true);
    expect(rewrapRes.action).toBe("rewrapped");
    expect(rewrapRes.fromVersion).toBe("v1");
    expect(rewrapRes.toVersion).toBe("v2");
    expect(rewrapRes.updated.key_version).toBe("v2");
    expect(rewrapRes.updated.encrypted_dek).not.toBe(encryptedV1.encrypted_dek);
    expect(rewrapRes.updated.password).toBe(encryptedV1.password);

    // Must decrypt with v2-only keyring (v1 retired!) and fail with v1-only keyring
    const decAfterRewrap = decryptRecordSecrets(
      rewrapRes.updated,
      CONNECTION_SECRET_FIELDS,
      ringV2Only
    );
    expect(decAfterRewrap.password).toBe("rotate-db-password");
    expect(decAfterRewrap.tokenClientSecret).toBe("rotate-oauth-secret");
    expect(() =>
      decryptRecordSecrets(rewrapRes.updated, CONNECTION_SECRET_FIELDS, ringV1)
    ).toThrow();

    // Re-running rewrap when already on v2 is a no-op
    const noOpRes = rotateRecordEnvelope(rewrapRes.updated, {
      mode: "rewrap",
      keyringOverride: ringDual,
    });
    expect(noOpRes.changed).toBe(false);
    expect(noOpRes.action).toBe("skipped");

    // 2. Full rotation (reencrypt): new DEK and new field IVs + ciphertexts
    const reencryptRes = rotateRecordEnvelope(encryptedV1, {
      mode: "reencrypt",
      keyringOverride: ringDual,
    });
    expect(reencryptRes.changed).toBe(true);
    expect(reencryptRes.action).toBe("reencrypted");
    expect(reencryptRes.updated.key_version).toBe("v2");
    expect(reencryptRes.updated.encrypted_dek).not.toBe(encryptedV1.encrypted_dek);
    expect(reencryptRes.updated.password).not.toBe(encryptedV1.password);
    expect(reencryptRes.updated.tokenClientSecret).not.toBe(encryptedV1.tokenClientSecret);

    const decAfterReencrypt = decryptRecordSecrets(
      reencryptRes.updated,
      CONNECTION_SECRET_FIELDS,
      ringV2Only
    );
    expect(decAfterReencrypt.password).toBe("rotate-db-password");
    expect(decAfterReencrypt.tokenClientSecret).toBe("rotate-oauth-secret");
  });

  test("masks secrets on client sanitization, preserves encrypted secrets across '********' edits, scrubs tokenBody, and lazy-upgrades key_version", () => {
    const k1 = makeKeyBase64();
    const k2 = makeKeyBase64();
    const ringV1 = loadMasterKeyring({ ENCRYPTION_MASTER_KEY_V1: k1 })!;
    const ringDual = loadMasterKeyring({
      ENCRYPTION_MASTER_KEY_V1: k1,
      ENCRYPTION_MASTER_KEY_V2: k2,
      ENCRYPTION_ACTIVE_KEY_VERSION: "v2",
    })!;

    const stored = encryptRecordSecrets(
      "connection:edit-flow",
      {
        id: "connection:edit-flow",
        url: "https://api.example.com",
        authType: "oauth",
        tokenPassword: "my-oauth-password",
        tokenClientSecret: "my-client-secret",
        tokenBody: "grant_type=password&client_id=admin-cli&password=my-oauth-password&client_secret=my-client-secret",
        bearerToken: "bao:secret/custom#bearerToken",
      },
      null,
      CONNECTION_SECRET_FIELDS,
      ringV1
    );

    // Duplicated secret params must be scrubbed from form-urlencoded tokenBody before saving in DB
    expect(stored.tokenBody).not.toContain("my-oauth-password");
    expect(stored.tokenBody).not.toContain("my-client-secret");
    expect(stored.tokenBody).toContain("grant_type=password");

    // Client sanitization never leaks ciphertexts or encrypted_dek, preserves masked placeholder & bao: ref
    const clientView = sanitizeConnectionForClient(stored);
    expect((clientView as any).encrypted_dek).toBeUndefined();
    expect(clientView.key_version).toBe("v1");
    expect(clientView.tokenPassword).toBe(MASKED_SECRET_PLACEHOLDER);
    expect(clientView.tokenClientSecret).toBe(MASKED_SECRET_PLACEHOLDER);
    expect(clientView.bearerToken).toBe("bao:secret/custom#bearerToken");
    expect(clientView.credentialSecurity).toBe("mixed");

    // Simulate PUT edit: client re-submits masked values + renames URL while server active key is now v2
    const merged = mergeMaskedConnectionSecrets(
      {
        ...clientView,
        url: "https://api-v2.example.com",
        encrypted_dek: "spoofed-dek",
        key_version: "v99",
      },
      stored,
      CONNECTION_SECRET_FIELDS
    );

    const updated = encryptRecordSecrets(
      "connection:edit-flow",
      merged,
      stored,
      CONNECTION_SECRET_FIELDS,
      ringDual
    );

    expect(updated.key_version).toBe("v2");
    expect(updated.tokenPassword).not.toBe(MASKED_SECRET_PLACEHOLDER);

    const decUpdated = decryptRecordSecrets(updated, CONNECTION_SECRET_FIELDS, ringDual);
    expect(decUpdated.tokenPassword).toBe("my-oauth-password");
    expect(decUpdated.tokenClientSecret).toBe("my-client-secret");
    expect(decUpdated.bearerToken).toBe("bao:secret/custom#bearerToken");

    // Forged/different `enc:aes256gcm:...` submitted as a user secret must NOT pass through unencrypted
    const forgedSecret = `enc:aes256gcm:${randomBytes(12).toString("base64url")}:${randomBytes(16).toString("base64url")}:${Buffer.from("forged").toString("base64url")}`;
    const reWrappedSubmitted = encryptRecordSecrets(
      "connection:edit-flow",
      { ...updated, tokenPassword: forgedSecret },
      updated,
      CONNECTION_SECRET_FIELDS,
      ringDual
    );
    expect(reWrappedSubmitted.tokenPassword).not.toBe(forgedSecret);
    const decForged = decryptRecordSecrets(reWrappedSubmitted, CONNECTION_SECRET_FIELDS, ringDual);
    expect(decForged.tokenPassword).toBe(forgedSecret);
  });

  test("fails closed when master key is not configured and saving DB secrets", () => {
    delete process.env.ENCRYPTION_MASTER_KEY_V1;
    delete process.env.ENCRYPTION_MASTER_KEYS;
    delete process.env.ALLOW_CLEARTEXT_DB_SECRETS;
    clearMasterKeyringCache();

    expect(() =>
      encryptRecordSecrets(
        "connection:no-key",
        { id: "connection:no-key", password: "secret-password" },
        null,
        CONNECTION_SECRET_FIELDS,
        null
      )
    ).toThrow(/master key is not configured/i);

    // Connections without secrets should still save cleanly without a master key
    const noSecretConn = encryptRecordSecrets(
      "connection:public-http",
      { id: "connection:public-http", url: "https://example.com", authType: "none" },
      null,
      CONNECTION_SECRET_FIELDS,
      null
    );
    expect(noSecretConn.encrypted_dek).toBeUndefined();
    expect(noSecretConn.key_version).toBeUndefined();
  });

  test("batch inventory and key rotation helper upgrades v1 + legacy cleartext + vault_config:main", async () => {
    const k1 = makeKeyBase64();
    const k2 = makeKeyBase64();
    process.env.ENCRYPTION_MASTER_KEY_V1 = k1;
    process.env.ENCRYPTION_ACTIVE_KEY_VERSION = "v1";
    clearMasterKeyringCache();

    const store = new Map<string, Record<string, any>>();
    store.set(
      "connection:c1",
      encryptRecordSecrets("connection:c1", {
        id: "connection:c1",
        name: "Encrypted V1",
        password: "p1-secret",
      })
    );
    store.set("connection:c2", {
      id: "connection:c2",
      name: "Legacy Cleartext",
      password: "legacy-plain-password",
    });
    store.set("connection:c3", {
      id: "connection:c3",
      name: "OpenBao Managed",
      password: "bao:secret/solidflow/connections/c3#password",
    });
    store.set(
      "vault_config:main",
      encryptRecordSecrets(
        "vault_config:main",
        { id: "vault_config:main", url: "http://127.0.0.1:8200", token: "hvs.v1-vault-token" },
        null,
        ["token"]
      )
    );

    const mockDb = {
      async select(thing: any) {
        const key = canonicalizeRecordId(thing);
        const rec = store.get(key);
        return rec ? { ...rec } : null;
      },
      async query(surql: string, vars?: Record<string, any>) {
        const rows = Array.from(store.values()).filter((r) => String(r.id).startsWith("connection:"));
        if (surql.includes("FROM connection")) {
          if (surql.includes("key_version != NONE AND key_version != $activeVersion")) {
            const matched = rows.filter((r) => r.key_version && r.key_version !== vars?.activeVersion);
            return surql.includes("count()") ? [[{ count: matched.length }]] : [matched.map((r) => ({ ...r }))];
          }
          if (surql.includes("key_version != NONE")) {
            return [rows.filter((r) => r.key_version !== undefined).map((r) => ({ ...r }))];
          }
          if (surql.includes("key_version = NONE")) {
            return [rows.filter((r) => !r.key_version).map((r) => ({ ...r }))];
          }
          return [rows.map((r) => ({ ...r }))];
        }
        if (surql.startsWith("UPDATE vault_config:main MERGE")) {
          store.set("vault_config:main", { ...store.get("vault_config:main"), ...(vars?.data || {}) });
          return [[store.get("vault_config:main")]];
        }
        if (surql.startsWith("UPDATE $id MERGE")) {
          const key = canonicalizeRecordId(vars?.id);
          store.set(key, { ...store.get(key), ...(vars?.data || {}) });
          return [[store.get(key)]];
        }
        return [[]];
      },
    };

    // Switch active key to v2 while keeping v1 loaded
    process.env.ENCRYPTION_MASTER_KEY_V2 = k2;
    process.env.ENCRYPTION_ACTIVE_KEY_VERSION = "v2";
    clearMasterKeyringCache();

    const invBefore = await getEncryptionInventory(mockDb);
    expect(invBefore.activeKeyVersion).toBe("v2");
    expect(invBefore.stats.outdatedKeyCount).toBe(1);
    expect(invBefore.stats.legacyCleartextCount).toBe(1);
    expect(invBefore.stats.openbaoCount).toBe(1);
    expect(invBefore.stats.vaultConfigNeedsRotation).toBe(true);

    // Dry run must NOT modify DB
    const drySummary = await rotateEncryptionKeys(mockDb, {
      mode: "rewrap",
      includeLegacyCleartext: true,
      dryRun: true,
    });
    expect(drySummary.dryRun).toBe(true);
    expect(drySummary.rotatedCount).toBe(1);
    expect(drySummary.migratedCleartextCount).toBe(1);
    expect(drySummary.vaultConfigRotated).toBe(true);
    expect(store.get("connection:c1")!.key_version).toBe("v1");
    expect(store.get("connection:c2")!.password).toBe("legacy-plain-password");

    // Live rotation
    const liveSummary = await rotateEncryptionKeys(mockDb, {
      mode: "rewrap",
      includeLegacyCleartext: true,
      dryRun: false,
    });
    expect(liveSummary.ok).toBe(true);
    expect(liveSummary.rotatedCount).toBe(1);
    expect(liveSummary.migratedCleartextCount).toBe(1);
    expect(liveSummary.remainingOutdatedCount).toBe(0);
    expect(liveSummary.vaultConfigRotated).toBe(true);

    // Retire v1 completely and confirm all encrypted records decrypt under v2 only
    delete process.env.ENCRYPTION_MASTER_KEY_V1;
    clearMasterKeyringCache();

    const decC1 = decryptRecordSecrets(store.get("connection:c1")!, CONNECTION_SECRET_FIELDS);
    const decC2 = decryptRecordSecrets(store.get("connection:c2")!, CONNECTION_SECRET_FIELDS);
    const decVc = decryptRecordSecrets(store.get("vault_config:main")!, ["token"], undefined, "vault_config:main");
    expect(decC1.password).toBe("p1-secret");
    expect(decC2.password).toBe("legacy-plain-password");
    expect(decVc.token).toBe("hvs.v1-vault-token");
    expect(store.get("connection:c3")!.password).toBe("bao:secret/solidflow/connections/c3#password");
  });
});
