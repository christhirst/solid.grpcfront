import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  CONNECTION_SECRET_FIELDS,
  ENCRYPTED_FIELD_PREFIX,
  MASKED_SECRET_PLACEHOLDER,
  WRAPPED_DEK_PREFIX,
  getCredentialSecuritySummary,
  isEncryptedSecretValue,
  isVaultSecretRef,
  isWrappedDekValue,
} from "~/lib/vaultRef";

export const ENVELOPE_ALGORITHM = "aes-256-gcm" as const;
export const ENVELOPE_KEY_BYTES = 32;
export const ENVELOPE_IV_BYTES = 12;
export const ENVELOPE_AUTH_TAG_BYTES = 16;

const VERSION_RE = /^v[1-9]\d*$/i;
const INDIVIDUAL_KEY_ENV_RE = /^ENCRYPTION_MASTER_KEY_(V[1-9]\d*)$/i;
const HEX_64_RE = /^[0-9a-fA-F]{64}$/;
const BASE64_CHAR_RE = /^[A-Za-z0-9+/]+=*$/;

export type KeyRotationMode = "rewrap" | "reencrypt";

export interface MasterKeyring {
  activeVersion: string;
  keys: Map<string, Buffer>;
  versions: string[];
}

export interface EncryptionStatusInfo {
  configured: boolean;
  activeKeyVersion: string | null;
  availableVersions: string[];
  error?: string;
}

export interface EnvelopeMetadataFields {
  encrypted_dek?: string;
  key_version?: string;
  key_rotated_at?: string;
}

export interface RotateRecordResult<T extends Record<string, any>> {
  updated: T & EnvelopeMetadataFields;
  changed: boolean;
  action: "rewrapped" | "reencrypted" | "encrypted_cleartext" | "skipped";
  fromVersion: string | null;
  toVersion: string;
}

let cachedEnvFingerprint: string | null = null;
let cachedEnvKeyring: MasterKeyring | null = null;
let warnedMissingExplicitActive = false;
let warnedCleartextDevFallback = false;

export function clearMasterKeyringCache(): void {
  cachedEnvFingerprint = null;
  cachedEnvKeyring = null;
  warnedMissingExplicitActive = false;
  warnedCleartextDevFallback = false;
}

export function generateMasterKeyBase64(): string {
  return randomBytes(ENVELOPE_KEY_BYTES).toString("base64");
}

export function normalizeKeyVersion(raw: string): string {
  const normalized = String(raw || "").trim().toLowerCase();
  if (!VERSION_RE.test(normalized)) {
    throw new Error(
      `Invalid master key version "${raw}". Expected format "v1", "v2", etc.`
    );
  }
  return normalized;
}

function compareKeyVersions(a: string, b: string): number {
  return Number(a.slice(1)) - Number(b.slice(1));
}

export function decodeKeyMaterial(raw: string, label = "master key"): Buffer {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

  if (!cleaned) {
    throw new Error(`Empty key material for ${label}.`);
  }

  let decoded: Buffer;
  if (HEX_64_RE.test(cleaned)) {
    decoded = Buffer.from(cleaned, "hex");
  } else {
    const standardB64 = cleaned.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
    const padLen = (4 - (standardB64.length % 4)) % 4;
    const padded = standardB64 + "=".repeat(padLen);
    if (!BASE64_CHAR_RE.test(padded)) {
      throw new Error(
        `Invalid encoding for ${label}. Expected a 32-byte key in base64 (44 chars), base64url (43 chars), or hex (64 chars).`
      );
    }
    decoded = Buffer.from(padded, "base64");
  }

  if (decoded.length !== ENVELOPE_KEY_BYTES) {
    throw new Error(
      `Invalid key length for ${label}: expected ${ENVELOPE_KEY_BYTES} bytes (256-bit), got ${decoded.length} bytes.`
    );
  }

  return decoded;
}

function parseMasterKeysEnvString(raw: string): Map<string, Buffer> {
  const result = new Map<string, Buffer>();
  const trimmed = raw.trim();
  if (!trimmed) return result;

  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err: any) {
      throw new Error(`Invalid JSON in ENCRYPTION_MASTER_KEYS: ${err?.message || err}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("ENCRYPTION_MASTER_KEYS JSON must be an object mapping versions to keys.");
    }
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== "string" || !v.trim()) {
        throw new Error(`ENCRYPTION_MASTER_KEYS entry "${k}" must be a non-empty string.`);
      }
      const ver = normalizeKeyVersion(k);
      result.set(ver, decodeKeyMaterial(v, `ENCRYPTION_MASTER_KEYS.${ver}`));
    }
    return result;
  }

  const entries = trimmed
    .split(/[,;\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx <= 0 || colonIdx === entry.length - 1) {
      throw new Error(
        `Invalid entry "${entry}" in ENCRYPTION_MASTER_KEYS. Expected "v1:<key>,v2:<key>".`
      );
    }
    const ver = normalizeKeyVersion(entry.slice(0, colonIdx));
    const keyStr = entry.slice(colonIdx + 1);
    result.set(ver, decodeKeyMaterial(keyStr, `ENCRYPTION_MASTER_KEYS.${ver}`));
  }

  return result;
}

function computeKeyEnvFingerprint(env: Record<string, string | undefined>): string {
  const parts: string[] = [
    `ACTIVE=${env.ENCRYPTION_ACTIVE_KEY_VERSION || ""}`,
    `MAP=${env.ENCRYPTION_MASTER_KEYS || ""}`,
  ];
  const versionedNames = Object.keys(env)
    .filter((k) => INDIVIDUAL_KEY_ENV_RE.test(k))
    .sort();
  for (const name of versionedNames) {
    parts.push(`${name}=${env[name] || ""}`);
  }
  return parts.join("|");
}

export function loadMasterKeyring(
  env: Record<string, string | undefined> = process.env
): MasterKeyring | null {
  const isDefaultProcessEnv = env === process.env;
  const fingerprint = isDefaultProcessEnv ? computeKeyEnvFingerprint(env) : "";

  if (isDefaultProcessEnv && cachedEnvFingerprint === fingerprint && cachedEnvFingerprint !== null) {
    return cachedEnvKeyring;
  }

  const keys = new Map<string, Buffer>();

  if (env.ENCRYPTION_MASTER_KEYS && env.ENCRYPTION_MASTER_KEYS.trim()) {
    const mapParsed = parseMasterKeysEnvString(env.ENCRYPTION_MASTER_KEYS);
    for (const [ver, buf] of mapParsed.entries()) {
      keys.set(ver, buf);
    }
  }

  for (const [envName, envVal] of Object.entries(env)) {
    const match = envName.match(INDIVIDUAL_KEY_ENV_RE);
    if (!match || !envVal || !envVal.trim()) continue;
    const ver = normalizeKeyVersion(match[1]);
    const buf = decodeKeyMaterial(envVal, envName);
    const existing = keys.get(ver);
    if (existing && !existing.equals(buf)) {
      throw new Error(
        `Conflicting key material for ${ver} between ${envName} and ENCRYPTION_MASTER_KEYS.`
      );
    }
    keys.set(ver, buf);
  }

  if (keys.size === 0) {
    if (isDefaultProcessEnv) {
      cachedEnvFingerprint = fingerprint;
      cachedEnvKeyring = null;
    }
    return null;
  }

  const versions = Array.from(keys.keys()).sort(compareKeyVersions);

  let activeVersion: string;
  const requestedActive = env.ENCRYPTION_ACTIVE_KEY_VERSION?.trim();
  if (requestedActive) {
    activeVersion = normalizeKeyVersion(requestedActive);
    if (!keys.has(activeVersion)) {
      throw new Error(
        `ENCRYPTION_ACTIVE_KEY_VERSION="${activeVersion}" is not present in loaded master keys (available: ${versions.join(", ")}).`
      );
    }
  } else {
    activeVersion = versions[versions.length - 1];
    if (versions.length > 1 && !warnedMissingExplicitActive) {
      warnedMissingExplicitActive = true;
      console.warn(
        `[ENCRYPTION] Multiple master key versions loaded (${versions.join(", ")}) without ENCRYPTION_ACTIVE_KEY_VERSION; defaulting to "${activeVersion}".`
      );
    }
  }

  const keyring: MasterKeyring = { activeVersion, keys, versions };
  if (isDefaultProcessEnv) {
    cachedEnvFingerprint = fingerprint;
    cachedEnvKeyring = keyring;
  }
  return keyring;
}

export function getEncryptionStatus(
  env: Record<string, string | undefined> = process.env
): EncryptionStatusInfo {
  try {
    const keyring = loadMasterKeyring(env);
    if (!keyring) {
      return {
        configured: false,
        activeKeyVersion: null,
        availableVersions: [],
      };
    }
    return {
      configured: true,
      activeKeyVersion: keyring.activeVersion,
      availableVersions: [...keyring.versions],
    };
  } catch (err: any) {
    return {
      configured: false,
      activeKeyVersion: null,
      availableVersions: [],
      error: err?.message || "Invalid encryption master key configuration",
    };
  }
}

export function canonicalizeRecordId(
  recordId: unknown,
  defaultTable = "connection"
): string {
  if (!recordId) return "";
  let raw = "";
  if (typeof recordId === "string") {
    raw = recordId;
  } else if (typeof recordId === "object" && ((recordId as any).tb || (recordId as any).table) && (recordId as any).id !== undefined) {
    const tbl = (recordId as any).tb || (recordId as any).table;
    raw = `${String(tbl)}:${String((recordId as any).id)}`;
  } else if (typeof (recordId as any).toString === "function") {
    raw = (recordId as any).toString();
  }
  const cleaned = raw.replace(/[⟨⟩]/g, "").trim();
  if (!cleaned) return "";
  return cleaned.includes(":") ? cleaned : `${defaultTable}:${cleaned}`;
}

function buildDekAad(recordId: string, keyVersion: string): Buffer {
  return Buffer.from(`solidflow:dek:${canonicalizeRecordId(recordId)}:${keyVersion}`, "utf8");
}

function buildFieldAad(recordId: string, fieldName: string): Buffer {
  return Buffer.from(`solidflow:field:${canonicalizeRecordId(recordId)}:${fieldName}`, "utf8");
}

export function encryptAes256Gcm(
  plaintext: Buffer | string,
  key: Buffer,
  aad: Buffer
): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  if (key.length !== ENVELOPE_KEY_BYTES) {
    throw new Error(`Invalid AES-256 key length: ${key.length} bytes.`);
  }
  const iv = randomBytes(ENVELOPE_IV_BYTES);
  const cipher = createCipheriv(ENVELOPE_ALGORITHM, key, iv, {
    authTagLength: ENVELOPE_AUTH_TAG_BYTES,
  });
  cipher.setAAD(aad);
  const inputBuf = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ciphertext = Buffer.concat([cipher.update(inputBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ciphertext };
}

export function decryptAes256Gcm(
  iv: Buffer,
  tag: Buffer,
  ciphertext: Buffer,
  key: Buffer,
  aad: Buffer
): Buffer {
  if (key.length !== ENVELOPE_KEY_BYTES) {
    throw new Error(`Invalid AES-256 key length: ${key.length} bytes.`);
  }
  if (iv.length !== ENVELOPE_IV_BYTES) {
    throw new Error(`Invalid AES-256-GCM IV length: ${iv.length} bytes.`);
  }
  if (tag.length !== ENVELOPE_AUTH_TAG_BYTES) {
    throw new Error(`Invalid AES-256-GCM auth tag length: ${tag.length} bytes.`);
  }
  const decipher = createDecipheriv(ENVELOPE_ALGORITHM, key, iv, {
    authTagLength: ENVELOPE_AUTH_TAG_BYTES,
  });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function parseEnvelopeParts(
  encoded: string,
  expectedPrefix: string,
  label: string
): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const trimmed = String(encoded || "").trim();
  if (!trimmed.startsWith(expectedPrefix)) {
    throw new Error(`Malformed ${label}: unexpected format prefix.`);
  }
  const parts = trimmed.split(":");
  if (parts.length !== 5) {
    throw new Error(`Malformed ${label}: invalid segment count.`);
  }
  const iv = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const ciphertext = Buffer.from(parts[4], "base64url");
  if (iv.length !== ENVELOPE_IV_BYTES || tag.length !== ENVELOPE_AUTH_TAG_BYTES) {
    throw new Error(`Malformed ${label}: invalid IV or auth tag length.`);
  }
  return { iv, tag, ciphertext };
}

export function wrapDek(
  dek: Buffer,
  kek: Buffer,
  recordId: string,
  keyVersion: string
): string {
  const { iv, tag, ciphertext } = encryptAes256Gcm(dek, kek, buildDekAad(recordId, keyVersion));
  return `${WRAPPED_DEK_PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function unwrapDek(
  wrappedDek: string,
  kek: Buffer,
  recordId: string,
  keyVersion: string
): Buffer {
  const { iv, tag, ciphertext } = parseEnvelopeParts(wrappedDek, WRAPPED_DEK_PREFIX, "wrapped DEK");
  const dek = decryptAes256Gcm(iv, tag, ciphertext, kek, buildDekAad(recordId, keyVersion));
  if (dek.length !== ENVELOPE_KEY_BYTES) {
    dek.fill(0);
    throw new Error(`Unwrapped DEK has unexpected length (${dek.length} bytes).`);
  }
  return dek;
}

export function encryptFieldValue(
  plaintext: string,
  dek: Buffer,
  recordId: string,
  fieldName: string
): string {
  const { iv, tag, ciphertext } = encryptAes256Gcm(
    plaintext,
    dek,
    buildFieldAad(recordId, fieldName)
  );
  return `${ENCRYPTED_FIELD_PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptFieldValue(
  encoded: string,
  dek: Buffer,
  recordId: string,
  fieldName: string
): string {
  const { iv, tag, ciphertext } = parseEnvelopeParts(encoded, ENCRYPTED_FIELD_PREFIX, `encrypted field "${fieldName}"`);
  return decryptAes256Gcm(iv, tag, ciphertext, dek, buildFieldAad(recordId, fieldName)).toString("utf8");
}

function isFormEncodedString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return Boolean(trimmed && !trimmed.startsWith("{") && !trimmed.startsWith("[") && trimmed.includes("="));
}

/**
 * Prevents OAuth password / client_secret duplication in form-urlencoded `tokenBody`:
 * - `"strip"`: hoists non-masked secret params into `tokenPassword` / `tokenClientSecret` before removal from `tokenBody`
 * - `"mask"`: replaces `password` / `client_secret` query values in `tokenBody` with `********` before returning to client
 */
export function scrubTokenBodySecrets(
  record: Record<string, any>,
  mode: "strip" | "mask"
): void {
  if (!record || !isFormEncodedString(record.tokenBody)) return;
  try {
    const params = new URLSearchParams(record.tokenBody.trim());
    let modified = false;

    const handleParam = (paramKey: string, targetField: string) => {
      if (!params.has(paramKey)) return;
      const paramVal = params.get(paramKey) || "";
      if (mode === "strip") {
        if (
          paramVal &&
          paramVal !== MASKED_SECRET_PLACEHOLDER &&
          (!record[targetField] || record[targetField] === MASKED_SECRET_PLACEHOLDER)
        ) {
          record[targetField] = paramVal;
        }
        params.delete(paramKey);
        modified = true;
      } else {
        if (paramVal && paramVal !== MASKED_SECRET_PLACEHOLDER) {
          params.set(paramKey, MASKED_SECRET_PLACEHOLDER);
          modified = true;
        }
      }
    };

    handleParam("password", "tokenPassword");
    handleParam("client_secret", "tokenClientSecret");

    if (modified) {
      record.tokenBody = params.toString();
    }
  } catch {
    // Ignore malformed tokenBody
  }
}

function requireKeyringForWrite(keyringOverride?: MasterKeyring | null): MasterKeyring | null {
  const keyring = keyringOverride !== undefined ? keyringOverride : loadMasterKeyring();
  if (keyring) return keyring;

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_CLEARTEXT_DB_SECRETS === "true"
  ) {
    if (!warnedCleartextDevFallback) {
      warnedCleartextDevFallback = true;
      console.warn(
        "[ENCRYPTION] Master key is not configured; storing DB secrets in cleartext because ALLOW_CLEARTEXT_DB_SECRETS=true (development only)."
      );
    }
    return null;
  }

  throw new Error(
    "Envelope encryption master key is not configured. Run 'bun run keys:generate' and set ENCRYPTION_MASTER_KEY_V1 (or ENCRYPTION_MASTER_KEYS) in your environment."
  );
}

/**
 * Encrypts all secret fields on a record using AES-256-GCM envelope encryption before persisting to SurrealDB.
 * - Generates a fresh 256-bit DEK for new records and a fresh 96-bit random IV per DEK wrap & per field.
 * - Preserves `"********"` placeholders by keeping existing encrypted values (or encrypting legacy cleartext).
 * - Lazily upgrades existing `v1` records to `activeVersion` on update.
 */
export function encryptRecordSecrets<T extends Record<string, any>>(
  recordId: string,
  payload: T,
  existingRecord?: Record<string, any> | null,
  secretFields: readonly string[] = CONNECTION_SECRET_FIELDS,
  keyringOverride?: MasterKeyring | null
): T & EnvelopeMetadataFields {
  const canonicalId = canonicalizeRecordId(recordId || payload?.id);
  const out: Record<string, any> = { ...payload };

  if (secretFields.includes("tokenPassword")) {
    scrubTokenBodySecrets(out, "strip");
  }

  // First pass: resolve masked placeholders and determine which fields need DB storage
  const dbSecretEntries: Array<{ field: string; value: string; alreadyEncrypted: boolean }> = [];

  for (const field of secretFields) {
    const incoming = out[field];
    if (typeof incoming !== "string" || incoming.trim().length === 0) {
      continue;
    }

    if (incoming === MASKED_SECRET_PLACEHOLDER) {
      const prevVal = existingRecord?.[field];
      if (typeof prevVal === "string" && prevVal.trim().length > 0) {
        if (isVaultSecretRef(prevVal)) {
          out[field] = prevVal;
        } else {
          out[field] = prevVal;
          dbSecretEntries.push({
            field,
            value: prevVal,
            alreadyEncrypted: isEncryptedSecretValue(prevVal),
          });
        }
      } else {
        delete out[field];
      }
      continue;
    }

    if (isVaultSecretRef(incoming)) {
      out[field] = incoming.trim();
      continue;
    }

    dbSecretEntries.push({
      field,
      value: incoming,
      alreadyEncrypted:
        isEncryptedSecretValue(incoming) &&
        incoming === existingRecord?.[field] &&
        Boolean(existingRecord?.encrypted_dek && existingRecord?.key_version),
    });
  }

  if (dbSecretEntries.length === 0) {
    delete out.encrypted_dek;
    delete out.key_version;
    delete out.key_rotated_at;
    return out as T & EnvelopeMetadataFields;
  }

  const keyring = requireKeyringForWrite(keyringOverride);
  if (!keyring) {
    // Explicit ALLOW_CLEARTEXT_DB_SECRETS=true in non-production dev
    delete out.encrypted_dek;
    delete out.key_version;
    delete out.key_rotated_at;
    return out as T & EnvelopeMetadataFields;
  }

  const targetVersion = keyring.activeVersion;
  const targetKek = keyring.keys.get(targetVersion)!;

  let dek: Buffer | null = null;
  let wrappedDek: string | null = null;
  let rotatedAt: string | undefined = out.key_rotated_at || existingRecord?.key_rotated_at;

  try {
    const hasExistingEnvelope = Boolean(
      existingRecord &&
        isWrappedDekValue(existingRecord.encrypted_dek) &&
        existingRecord.key_version
    );

    if (hasExistingEnvelope) {
      const prevVersion = String(existingRecord!.key_version);
      const prevKek = keyring.keys.get(prevVersion);
      if (!prevKek) {
        throw new Error(
          `Cannot update encrypted record "${canonicalId}": previous key version "${prevVersion}" is not in the active keyring.`
        );
      }
      dek = unwrapDek(existingRecord!.encrypted_dek, prevKek, canonicalId, prevVersion);

      if (prevVersion === targetVersion) {
        wrappedDek = existingRecord!.encrypted_dek;
      } else {
        // Lazy upgrade DEK wrapping to active key version with a fresh IV
        wrappedDek = wrapDek(dek, targetKek, canonicalId, targetVersion);
        rotatedAt = new Date().toISOString();
      }
    } else {
      dek = randomBytes(ENVELOPE_KEY_BYTES);
      wrappedDek = wrapDek(dek, targetKek, canonicalId, targetVersion);
    }

    for (const entry of dbSecretEntries) {
      if (entry.alreadyEncrypted && hasExistingEnvelope) {
        // Verify preserved ciphertext only when changing key material? No — if payload carried
        // existing ciphertext from existingRecord under the same DEK, keep it intact (no churn).
        out[entry.field] = entry.value;
      } else {
        out[entry.field] = encryptFieldValue(entry.value, dek, canonicalId, entry.field);
      }
    }

    out.encrypted_dek = wrappedDek;
    out.key_version = targetVersion;
    if (rotatedAt) {
      out.key_rotated_at = rotatedAt;
    }

    return out as T & EnvelopeMetadataFields;
  } finally {
    dek?.fill(0);
  }
}

/**
 * Decrypts all `enc:aes256gcm:...` fields on a record in-memory.
 * No-ops immediately when no encrypted fields exist (fast path for OpenBao / auth-none / legacy records).
 */
export function decryptRecordSecrets<T extends Record<string, any>>(
  record: T,
  secretFields: readonly string[] = CONNECTION_SECRET_FIELDS,
  keyringOverride?: MasterKeyring | null,
  explicitRecordId?: string
): T {
  if (!record || typeof record !== "object") return record;

  const encryptedFieldsToDecrypt: string[] = [];
  for (const field of secretFields) {
    if (isEncryptedSecretValue(record[field])) {
      encryptedFieldsToDecrypt.push(field);
    }
  }

  if (encryptedFieldsToDecrypt.length === 0) {
    return record;
  }

  const canonicalId = canonicalizeRecordId(explicitRecordId || record.id);
  if (!canonicalId) {
    throw new Error("Cannot decrypt encrypted record without a valid record id.");
  }

  const keyVersion = typeof record.key_version === "string" ? record.key_version.trim() : "";
  if (!keyVersion || !isWrappedDekValue(record.encrypted_dek)) {
    throw new Error(
      `Encrypted record "${canonicalId}" is missing key_version or encrypted_dek envelope metadata.`
    );
  }

  const keyring = keyringOverride !== undefined ? keyringOverride : loadMasterKeyring();
  if (!keyring) {
    throw new Error(
      `Cannot decrypt record "${canonicalId}": envelope encryption master key is not configured.`
    );
  }

  const kek = keyring.keys.get(keyVersion);
  if (!kek) {
    throw new Error(
      `Cannot decrypt record "${canonicalId}": master key version "${keyVersion}" is not loaded (available: ${keyring.versions.join(", ")}).`
    );
  }

  const out: Record<string, any> = { ...record };
  let dek: Buffer | null = null;
  try {
    dek = unwrapDek(record.encrypted_dek, kek, canonicalId, keyVersion);
    for (const field of encryptedFieldsToDecrypt) {
      out[field] = decryptFieldValue(record[field], dek, canonicalId, field);
    }
    return out as T & EnvelopeMetadataFields;
  } finally {
    dek?.fill(0);
  }
}

/**
 * Rotates a single record's envelope encryption to the currently active master key version.
 * - `mode: "rewrap"`: Unwraps DEK with old KEK, generates a new 12-byte IV, wraps DEK with active KEK.
 * - `mode: "reencrypt"`: Decrypts all encrypted fields, generates a new 32-byte DEK, re-encrypts every field
 *   with a fresh 12-byte IV, and wraps the new DEK with the active KEK.
 */
export function rotateRecordEnvelope<T extends Record<string, any>>(
  record: T,
  options?: {
    mode?: KeyRotationMode;
    includeLegacyCleartext?: boolean;
    secretFields?: readonly string[];
    keyringOverride?: MasterKeyring | null;
    explicitRecordId?: string;
  }
): RotateRecordResult<T> {
  const mode: KeyRotationMode = options?.mode || "rewrap";
  const includeLegacyCleartext = Boolean(options?.includeLegacyCleartext);
  const secretFields = options?.secretFields || CONNECTION_SECRET_FIELDS;
  const keyring =
    options?.keyringOverride !== undefined ? options.keyringOverride : loadMasterKeyring();

  if (!keyring) {
    throw new Error(
      "Cannot rotate keys: envelope encryption master key is not configured."
    );
  }

  const targetVersion = keyring.activeVersion;
  const targetKek = keyring.keys.get(targetVersion)!;
  const canonicalId = canonicalizeRecordId(options?.explicitRecordId || record?.id);
  const summary = getCredentialSecuritySummary(record, secretFields);

  if (summary.encryptedFields.length === 0 && summary.cleartextFields.length === 0) {
    return {
      updated: record,
      changed: false,
      action: "skipped",
      fromVersion: record?.key_version || null,
      toVersion: targetVersion,
    };
  }

  // Legacy cleartext-only record
  if (summary.encryptedFields.length === 0 && summary.cleartextFields.length > 0) {
    if (!includeLegacyCleartext) {
      return {
        updated: record,
        changed: false,
        action: "skipped",
        fromVersion: null,
        toVersion: targetVersion,
      };
    }
    const encrypted = encryptRecordSecrets(canonicalId, record, null, secretFields, keyring);
    return {
      updated: { ...encrypted, key_rotated_at: new Date().toISOString() },
      changed: true,
      action: "encrypted_cleartext",
      fromVersion: null,
      toVersion: targetVersion,
    };
  }

  // Has encrypted fields
  const fromVersion = typeof record.key_version === "string" ? record.key_version.trim() : "";
  if (!fromVersion || !isWrappedDekValue(record.encrypted_dek)) {
    throw new Error(
      `Record "${canonicalId}" has encrypted fields but is missing valid key_version or encrypted_dek.`
    );
  }

  if (
    fromVersion === targetVersion &&
    mode === "rewrap" &&
    summary.cleartextFields.length === 0
  ) {
    return {
      updated: record,
      changed: false,
      action: "skipped",
      fromVersion,
      toVersion: targetVersion,
    };
  }

  const oldKek = keyring.keys.get(fromVersion);
  if (!oldKek) {
    throw new Error(
      `Cannot rotate record "${canonicalId}": previous key version "${fromVersion}" is missing from master keyring (available: ${keyring.versions.join(", ")}).`
    );
  }

  let oldDek: Buffer | null = null;
  let newDek: Buffer | null = null;
  const now = new Date().toISOString();

  try {
    oldDek = unwrapDek(record.encrypted_dek, oldKek, canonicalId, fromVersion);

    if (mode === "rewrap" && summary.cleartextFields.length === 0) {
      const nextWrappedDek = wrapDek(oldDek, targetKek, canonicalId, targetVersion);
      return {
        updated: {
          ...record,
          encrypted_dek: nextWrappedDek,
          key_version: targetVersion,
          key_rotated_at: now,
        },
        changed: true,
        action: "rewrapped",
        fromVersion,
        toVersion: targetVersion,
      };
    }

    // Full reencrypt (or mixed encrypted + legacy cleartext): decrypt all encrypted fields,
    // generate fresh DEK + fresh IV per field, wrap new DEK with active KEK.
    const nextObj: Record<string, any> = { ...record };
    if (secretFields.includes("tokenPassword")) {
      scrubTokenBodySecrets(nextObj, "strip");
    }

    newDek = randomBytes(ENVELOPE_KEY_BYTES);

    for (const field of secretFields) {
      const val = nextObj[field];
      if (typeof val !== "string" || val.trim().length === 0) continue;
      if (isVaultSecretRef(val)) continue;

      const plaintext = isEncryptedSecretValue(val)
        ? decryptFieldValue(val, oldDek, canonicalId, field)
        : val;
      nextObj[field] = encryptFieldValue(plaintext, newDek, canonicalId, field);
    }

    nextObj.encrypted_dek = wrapDek(newDek, targetKek, canonicalId, targetVersion);
    nextObj.key_version = targetVersion;
    nextObj.key_rotated_at = now;

    return {
      updated: nextObj as T,
      changed: true,
      action: "reencrypted",
      fromVersion,
      toVersion: targetVersion,
    };
  } finally {
    oldDek?.fill(0);
    newDek?.fill(0);
  }
}

/**
 * Strips server-only envelope metadata (`encrypted_dek`) and masks DB secret values (`"********"`)
 * before sending connection records to client browsers, while preserving `credentialSecurity`, `key_version`,
 * and `bao:...` vault pointers.
 */
export function sanitizeConnectionForClient<T extends Record<string, any>>(
  conn: T,
  secretFields: readonly string[] = CONNECTION_SECRET_FIELDS
): T & {
  credentialSecurity?: string;
  vaultFields?: string[];
  encryptedFields?: string[];
  cleartextFields?: string[];
  key_version?: string;
  key_rotated_at?: string;
} {
  if (!conn || typeof conn !== "object") return conn as any;

  const out: Record<string, any> = { ...conn };

  if (!out.credentialSecurity) {
    const summary = getCredentialSecuritySummary(out, secretFields);
    out.credentialSecurity = summary.status;
    out.vaultFields = summary.vaultFields;
    out.encryptedFields = summary.encryptedFields;
    out.cleartextFields = summary.cleartextFields;
  }

  delete out.encrypted_dek;
  delete out.dek_iv;
  delete out.dek_tag;

  for (const field of secretFields) {
    const val = out[field];
    if (typeof val === "string" && val.trim().length > 0 && !isVaultSecretRef(val)) {
      out[field] = MASKED_SECRET_PLACEHOLDER;
    }
  }

  scrubTokenBodySecrets(out, "mask");
  return out as any;
}

/**
 * Merges incoming client/edit payload with an existing DB connection record so `"********"` placeholders
 * restore stored encrypted ciphertexts and envelope metadata (`id`, `encrypted_dek`, `key_version`),
 * preventing clients from clobbering or double-encrypting masked passwords or spoofing `key_version`.
 */
export function mergeMaskedConnectionSecrets(
  incoming: Record<string, any>,
  existingDbRecord?: Record<string, any> | null,
  secretFields: readonly string[] = CONNECTION_SECRET_FIELDS
): Record<string, any> {
  const merged: Record<string, any> = { ...incoming };

  if (existingDbRecord) {
    // Always trust DB envelope metadata over any client-supplied fields
    if (existingDbRecord.id !== undefined) {
      merged.id = existingDbRecord.id;
    }
    if (existingDbRecord.encrypted_dek !== undefined) {
      merged.encrypted_dek = existingDbRecord.encrypted_dek;
    } else {
      delete merged.encrypted_dek;
    }
    if (existingDbRecord.key_version !== undefined) {
      merged.key_version = existingDbRecord.key_version;
    } else {
      delete merged.key_version;
    }
    if (existingDbRecord.key_rotated_at !== undefined && merged.key_rotated_at === undefined) {
      merged.key_rotated_at = existingDbRecord.key_rotated_at;
    }

    for (const field of secretFields) {
      if (merged[field] === MASKED_SECRET_PLACEHOLDER) {
        if (existingDbRecord[field] !== undefined) {
          merged[field] = existingDbRecord[field];
        } else {
          delete merged[field];
        }
      }
    }
  } else {
    delete merged.encrypted_dek;
    delete merged.key_version;
  }

  // Strip masked placeholders from form-urlencoded tokenBody so test/save logic uses restored fields
  if (isFormEncodedString(merged.tokenBody)) {
    try {
      const params = new URLSearchParams(merged.tokenBody.trim());
      let changed = false;
      if (params.get("password") === MASKED_SECRET_PLACEHOLDER) {
        params.delete("password");
        changed = true;
      }
      if (params.get("client_secret") === MASKED_SECRET_PLACEHOLDER) {
        params.delete("client_secret");
        changed = true;
      }
      if (changed) {
        merged.tokenBody = params.toString();
      }
    } catch {}
  }

  return merged;
}
