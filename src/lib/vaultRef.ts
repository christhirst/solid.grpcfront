export const CONNECTION_SECRET_FIELDS = [
  "password",
  "bearerToken",
  "tokenPassword",
  "tokenBearerToken",
  "tokenClientSecret",
  "secretAccessKey",
  "sessionToken",
] as const;

export const STEP_SECRET_FIELDS = [
  "authPassword",
  "bearerToken",
  "tokenPassword",
  "tokenBearerToken",
  "tokenClientSecret",
  "databasePass",
  "s3SecretAccessKey",
] as const;

export const MASKED_SECRET_PLACEHOLDER = "********";
export const ENCRYPTED_FIELD_PREFIX = "enc:aes256gcm:";
export const WRAPPED_DEK_PREFIX = "dek:aes256gcm:";

export type CredentialSecurityStatus = "openbao" | "encrypted" | "cleartext" | "mixed" | "none";

export interface CredentialSecuritySummary {
  status: CredentialSecurityStatus;
  vaultFields: string[];
  encryptedFields: string[];
  cleartextFields: string[];
}

// 12-byte IV (16 base64url chars), 16-byte GCM auth tag (22 base64url chars), variable ciphertext
const ENCRYPTED_SECRET_RE = /^enc:aes256gcm:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]*$/;
const WRAPPED_DEK_RE = /^dek:aes256gcm:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]+$/;

export function isEncryptedSecretValue(value: unknown): boolean {
  return typeof value === "string" && ENCRYPTED_SECRET_RE.test(value.trim());
}

export function isWrappedDekValue(value: unknown): boolean {
  return typeof value === "string" && WRAPPED_DEK_RE.test(value.trim());
}

export interface VaultSecretRef {
  mount?: string;
  path: string;
  key: string;
  raw: string;
}

/**
 * Parses a vault secret reference string.
 * Supported formats:
 *   1. bao:<mount>/<path>#<key>   (e.g. bao:secret/solidflow/connections/conn1#password)
 *   2. vaultSecret("<mount>/<path>#<key>") or vaultSecret('<mount>/<path>#<key>')
 */
export function parseVaultSecretRef(value: unknown): VaultSecretRef | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let inner = "";
  if (trimmed.startsWith("bao:")) {
    inner = trimmed.slice(4).trim();
  } else {
    const fnMatch = trimmed.match(/^vaultSecret\(\s*["']([^"']+)["']\s*\)$/);
    if (fnMatch) {
      inner = fnMatch[1].trim();
    }
  }

  if (!inner) return null;
  const hashIdx = inner.lastIndexOf("#");
  if (hashIdx <= 0 || hashIdx === inner.length - 1) return null;

  const fullPath = inner.slice(0, hashIdx).replace(/^\/+|\/+$/g, "");
  const key = inner.slice(hashIdx + 1).trim();
  if (!fullPath || !key) return null;

  const segments = fullPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  if (segments.length === 1) {
    return {
      path: segments[0],
      key,
      raw: trimmed,
    };
  }

  return {
    mount: segments[0],
    path: segments.slice(1).join("/"),
    key,
    raw: trimmed,
  };
}

export function isVaultSecretRef(value: unknown): boolean {
  return parseVaultSecretRef(value) !== null;
}

export function formatVaultSecretRef(mount: string, path: string, key: string): string {
  const cleanMount = (mount || "secret").replace(/^\/+|\/+$/g, "");
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  return `bao:${cleanMount}/${cleanPath}#${key}`;
}

/**
 * Analyzes an object (Connection or WorkflowStep) and determines whether its secrets
 * are stored in OpenBao, encrypted in SurrealDB, cleartext in SurrealDB, mixed, or none.
 */
export function getCredentialSecuritySummary(
  obj: Record<string, any> | null | undefined,
  secretFields: readonly string[] = CONNECTION_SECRET_FIELDS
): CredentialSecuritySummary {
  if (!obj || typeof obj !== "object") {
    return { status: "none", vaultFields: [], encryptedFields: [], cleartextFields: [] };
  }

  const vaultFields: string[] = [];
  const encryptedFields: string[] = [];
  const cleartextFields: string[] = [];

  for (const field of secretFields) {
    const val = obj[field];
    if (typeof val === "string" && val.trim().length > 0) {
      if (isVaultSecretRef(val)) {
        vaultFields.push(field);
      } else if (isEncryptedSecretValue(val)) {
        encryptedFields.push(field);
      } else {
        cleartextFields.push(field);
      }
    }
  }

  const nonEmptyCategories =
    (vaultFields.length > 0 ? 1 : 0) +
    (encryptedFields.length > 0 ? 1 : 0) +
    (cleartextFields.length > 0 ? 1 : 0);

  let status: CredentialSecurityStatus = "none";
  if (nonEmptyCategories > 1) {
    status = "mixed";
  } else if (vaultFields.length > 0) {
    status = "openbao";
  } else if (encryptedFields.length > 0) {
    status = "encrypted";
  } else if (cleartextFields.length > 0) {
    status = "cleartext";
  }

  return { status, vaultFields, encryptedFields, cleartextFields };
}
