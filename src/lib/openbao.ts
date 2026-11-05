import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { RecordId } from "surrealdb";
import { getDb } from "./db";
import { getCaCertContent } from "./connections";
import {
  CONNECTION_SECRET_FIELDS,
  STEP_SECRET_FIELDS,
  parseVaultSecretRef,
  isVaultSecretRef,
  formatVaultSecretRef,
  getCredentialSecuritySummary,
  type CredentialSecurityStatus,
  type CredentialSecuritySummary,
  type VaultSecretRef,
} from "./vaultRef";

export {
  CONNECTION_SECRET_FIELDS,
  STEP_SECRET_FIELDS,
  parseVaultSecretRef,
  isVaultSecretRef,
  formatVaultSecretRef,
  getCredentialSecuritySummary,
  type CredentialSecurityStatus,
  type CredentialSecuritySummary,
  type VaultSecretRef,
};

export interface OpenBaoConfig {
  url: string;
  token: string;
  mount: string;
  namespace?: string;
  caId?: string;
  acceptInvalidCert?: boolean;
  source: "db" | "env" | "token-file" | "none";
}

export interface OpenBaoStatus {
  configured: boolean;
  connected: boolean;
  initialized?: boolean;
  sealed?: boolean;
  version?: string;
  url: string;
  mount: string;
  namespace?: string;
  caId?: string;
  acceptInvalidCert?: boolean;
  hasToken: boolean;
  source: "db" | "env" | "token-file" | "none";
  error?: string;
}

// Cache DB vault config for 15s to avoid hitting SurrealDB on every secret resolution
let cachedDbConfig: { value: Partial<OpenBaoConfig> | null; expiresAt: number } | null = null;
const DB_CONFIG_TTL_MS = 15_000;

// Short-lived in-memory cache for resolved secrets (15s) to speed up multi-step workflows
const secretValueCache = new Map<string, { value: string; expiresAt: number }>();
const SECRET_CACHE_TTL_MS = 15_000;

export function clearOpenBaoCaches(): void {
  cachedDbConfig = null;
  secretValueCache.clear();
}

function readTokenFromFile(): string {
  try {
    const home = homedir();
    const baoTokenPath = join(home, ".bao-token");
    if (existsSync(baoTokenPath)) {
      return readFileSync(baoTokenPath, "utf-8").trim();
    }
    const vaultTokenPath = join(home, ".vault-token");
    if (existsSync(vaultTokenPath)) {
      return readFileSync(vaultTokenPath, "utf-8").trim();
    }
  } catch {
    // Ignore file read errors in restricted environments
  }
  return "";
}

async function loadDbVaultConfig(): Promise<Partial<OpenBaoConfig> | null> {
  const now = Date.now();
  if (cachedDbConfig && cachedDbConfig.expiresAt > now) {
    return cachedDbConfig.value;
  }
  try {
    const db = await getDb();
    if (!db) return null;
    const rec: any = await db.select(new RecordId("vault_config", "main")).catch(() => null);
    const val = rec && typeof rec === "object" && !Array.isArray(rec) ? rec : null;
    cachedDbConfig = { value: val, expiresAt: now + DB_CONFIG_TTL_MS };
    return val;
  } catch {
    return null;
  }
}

export async function getOpenBaoConfig(override?: Partial<OpenBaoConfig>): Promise<OpenBaoConfig> {
  const envUrl = (process.env.OPENBAO_ADDR || process.env.VAULT_ADDR || "").trim();
  const envToken = (process.env.OPENBAO_TOKEN || process.env.VAULT_TOKEN || "").trim();
  const envMount = (process.env.OPENBAO_MOUNT || process.env.VAULT_MOUNT || "").trim();
  const envNamespace = (process.env.OPENBAO_NAMESPACE || process.env.VAULT_NAMESPACE || "").trim();
  const fileToken = envToken ? "" : readTokenFromFile();

  // Only query DB if override doesn't already provide both url and token
  const dbCfg = override?.url && override?.token ? null : await loadDbVaultConfig();

  const url = (override?.url ?? dbCfg?.url ?? envUrl ?? "").trim().replace(/\/+$/, "");
  const token = (override?.token ?? dbCfg?.token ?? envToken ?? fileToken ?? "").trim();
  const mount = (override?.mount ?? dbCfg?.mount ?? envMount ?? "secret").trim().replace(/^\/+|\/+$/g, "") || "secret";
  const namespace = (override?.namespace ?? dbCfg?.namespace ?? envNamespace ?? "").trim() || undefined;
  const caId = override?.caId ?? dbCfg?.caId ?? undefined;
  const acceptInvalidCert = Boolean(override?.acceptInvalidCert ?? dbCfg?.acceptInvalidCert ?? false);

  let source: OpenBaoConfig["source"] = "none";
  if (override?.url || dbCfg?.url || dbCfg?.token) {
    source = "db";
  } else if (envUrl || envToken) {
    source = "env";
  } else if (fileToken) {
    source = "token-file";
  }

  return {
    url: url || (source === "token-file" ? "http://127.0.0.1:8200" : ""),
    token,
    mount,
    namespace,
    caId,
    acceptInvalidCert,
    source,
  };
}

export async function saveOpenBaoConfig(input: {
  url: string;
  token?: string;
  mount?: string;
  namespace?: string;
  caId?: string;
  acceptInvalidCert?: boolean;
}): Promise<OpenBaoConfig> {
  const db = await getDb();
  if (!db) throw new Error("Database not available to save OpenBao configuration");

  const existing: any = await db.select(new RecordId("vault_config", "main")).catch(() => null);
  const nextToken =
    input.token !== undefined && input.token !== "********"
      ? input.token.trim()
      : existing?.token || "";

  const payload = {
    url: (input.url || "").trim().replace(/\/+$/, ""),
    token: nextToken,
    mount: (input.mount || "secret").trim().replace(/^\/+|\/+$/g, "") || "secret",
    namespace: (input.namespace || "").trim(),
    caId: input.caId || "",
    acceptInvalidCert: Boolean(input.acceptInvalidCert),
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.upsert(new RecordId("vault_config", "main")).content(payload);
  } catch {
    await db.query(`UPSERT vault_config:main CONTENT $data`, { data: payload });
  }

  clearOpenBaoCaches();
  return getOpenBaoConfig();
}

async function buildFetchOptions(
  cfg: OpenBaoConfig,
  init: RequestInit = {}
): Promise<RequestInit & { tls?: any }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (cfg.token) {
    headers["X-Vault-Token"] = cfg.token;
  }
  if (cfg.namespace) {
    headers["X-Vault-Namespace"] = cfg.namespace;
  }

  const options: RequestInit & { tls?: any } = {
    ...init,
    headers,
  };

  if (cfg.acceptInvalidCert) {
    options.tls = { rejectUnauthorized: false };
  } else if (cfg.caId) {
    const caPem = await getCaCertContent(cfg.caId);
    if (caPem) {
      options.tls = { ca: caPem, rejectUnauthorized: true };
    }
  }

  return options;
}

/**
 * Checks OpenBao health & token validity.
 */
export async function getOpenBaoStatus(override?: Partial<OpenBaoConfig>): Promise<OpenBaoStatus> {
  const cfg = await getOpenBaoConfig(override);
  if (!cfg.url) {
    return {
      configured: false,
      connected: false,
      url: "",
      mount: cfg.mount,
      namespace: cfg.namespace,
      caId: cfg.caId,
      acceptInvalidCert: cfg.acceptInvalidCert,
      hasToken: Boolean(cfg.token),
      source: cfg.source,
      error: "OpenBao URL is not configured.",
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const opts = await buildFetchOptions(cfg, { method: "GET", signal: controller.signal });
    const healthRes = await fetch(`${cfg.url}/v1/sys/health`, opts);
    clearTimeout(timer);

    let healthData: any = null;
    try {
      healthData = await healthRes.json();
    } catch {
      // ignore non-json health output
    }

    const initialized = healthData?.initialized ?? true;
    const sealed = healthData?.sealed ?? (healthRes.status === 503);
    const version = healthData?.version || undefined;

    if (sealed) {
      return {
        configured: true,
        connected: false,
        initialized,
        sealed: true,
        version,
        url: cfg.url,
        mount: cfg.mount,
        namespace: cfg.namespace,
        caId: cfg.caId,
        acceptInvalidCert: cfg.acceptInvalidCert,
        hasToken: Boolean(cfg.token),
        source: cfg.source,
        error: "OpenBao server is reachable but currently sealed.",
      };
    }

    if (!cfg.token) {
      return {
        configured: true,
        connected: false,
        initialized,
        sealed: false,
        version,
        url: cfg.url,
        mount: cfg.mount,
        namespace: cfg.namespace,
        caId: cfg.caId,
        acceptInvalidCert: cfg.acceptInvalidCert,
        hasToken: false,
        source: cfg.source,
        error: "OpenBao server is online, but no Vault/OpenBao token is configured.",
      };
    }

    // Verify token via /v1/auth/token/lookup-self
    const tokenOpts = await buildFetchOptions(cfg, { method: "GET" });
    const tokenRes = await fetch(`${cfg.url}/v1/auth/token/lookup-self`, tokenOpts);
    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => "");
      return {
        configured: true,
        connected: false,
        initialized,
        sealed: false,
        version,
        url: cfg.url,
        mount: cfg.mount,
        namespace: cfg.namespace,
        caId: cfg.caId,
        acceptInvalidCert: cfg.acceptInvalidCert,
        hasToken: true,
        source: cfg.source,
        error: `OpenBao authentication failed (HTTP ${tokenRes.status}): ${errText.slice(0, 140)}`,
      };
    }

    return {
      configured: true,
      connected: true,
      initialized,
      sealed: false,
      version,
      url: cfg.url,
      mount: cfg.mount,
      namespace: cfg.namespace,
      caId: cfg.caId,
      acceptInvalidCert: cfg.acceptInvalidCert,
      hasToken: true,
      source: cfg.source,
    };
  } catch (err: any) {
    return {
      configured: Boolean(cfg.url),
      connected: false,
      url: cfg.url,
      mount: cfg.mount,
      namespace: cfg.namespace,
      caId: cfg.caId,
      acceptInvalidCert: cfg.acceptInvalidCert,
      hasToken: Boolean(cfg.token),
      source: cfg.source,
      error: err?.message || "Failed to connect to OpenBao",
    };
  }
}

/**
 * Writes (and merges) key-value pairs into OpenBao KV v2 at /v1/<mount>/data/<path>.
 */
export async function writeVaultSecrets(
  path: string,
  dataMap: Record<string, string>,
  mountOverride?: string,
  configOverride?: Partial<OpenBaoConfig>
): Promise<{ mount: string; path: string }> {
  const cfg = await getOpenBaoConfig(configOverride);
  if (!cfg.url || !cfg.token) {
    throw new Error("OpenBao is not configured (missing URL or token). Configure OpenBao or switch to Cleartext DB storage.");
  }

  const mount = (mountOverride || cfg.mount || "secret").replace(/^\/+|\/+$/g, "");
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  const kvDataUrl = `${cfg.url}/v1/${mount}/data/${cleanPath}`;

  // Read existing keys first so partial updates preserve sibling keys at the same path
  let existingData: Record<string, any> = {};
  try {
    const getOpts = await buildFetchOptions(cfg, { method: "GET" });
    const getRes = await fetch(kvDataUrl, getOpts);
    if (getRes.ok) {
      const json: any = await getRes.json();
      const current = json?.data?.data ?? json?.data;
      if (current && typeof current === "object") {
        existingData = { ...current };
      }
    }
  } catch {
    // Path may not exist yet; proceed with write
  }

  const merged = { ...existingData, ...dataMap };
  const postOpts = await buildFetchOptions(cfg, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: merged }),
  });

  const postRes = await fetch(kvDataUrl, postOpts);
  if (!postRes.ok) {
    const errText = await postRes.text().catch(() => "");
    throw new Error(`Failed to write secret to OpenBao (${mount}/${cleanPath}, HTTP ${postRes.status}): ${errText.slice(0, 200)}`);
  }

  // Update cache for written keys
  const now = Date.now();
  for (const [k, v] of Object.entries(dataMap)) {
    const ref = formatVaultSecretRef(mount, cleanPath, k);
    secretValueCache.set(ref, { value: v, expiresAt: now + SECRET_CACHE_TTL_MS });
  }

  return { mount, path: cleanPath };
}

/**
 * Reads a single secret value from OpenBao KV v2 using a reference string.
 */
export async function readVaultSecret(
  refString: string,
  configOverride?: Partial<OpenBaoConfig>
): Promise<string> {
  const parsed = parseVaultSecretRef(refString);
  if (!parsed) {
    return refString;
  }

  const cfg = await getOpenBaoConfig(configOverride);
  const mount = (parsed.mount || cfg.mount || "secret").replace(/^\/+|\/+$/g, "");
  const canonicalRef = formatVaultSecretRef(mount, parsed.path, parsed.key);

  const now = Date.now();
  const cached = secretValueCache.get(canonicalRef);
  if (cached && cached.expiresAt > now && !configOverride) {
    return cached.value;
  }

  if (!cfg.url || !cfg.token) {
    throw new Error(
      `Cannot resolve OpenBao secret "${parsed.raw}": OpenBao URL or token is not configured.`
    );
  }

  const kvDataUrl = `${cfg.url}/v1/${mount}/data/${parsed.path}`;
  const getOpts = await buildFetchOptions(cfg, { method: "GET" });
  const res = await fetch(kvDataUrl, getOpts);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Failed to read secret "${parsed.raw}" from OpenBao (HTTP ${res.status}): ${errText.slice(0, 180)}`
    );
  }

  const json: any = await res.json();
  // Support KV v2 (json.data.data[key]) and KV v1 fallback (json.data[key])
  const secretMap = json?.data?.data && typeof json.data.data === "object" ? json.data.data : json?.data;
  const val = secretMap?.[parsed.key];
  if (val === undefined || val === null) {
    throw new Error(`Key "${parsed.key}" not found in OpenBao path "${mount}/${parsed.path}"`);
  }

  const strVal = String(val);
  secretValueCache.set(canonicalRef, { value: strVal, expiresAt: now + SECRET_CACHE_TTL_MS });
  return strVal;
}

/**
 * Deletes metadata & all versions of a secret path in OpenBao KV v2.
 */
export async function deleteVaultSecrets(
  path: string,
  mountOverride?: string,
  configOverride?: Partial<OpenBaoConfig>
): Promise<void> {
  const cfg = await getOpenBaoConfig(configOverride);
  if (!cfg.url || !cfg.token) return;

  const mount = (mountOverride || cfg.mount || "secret").replace(/^\/+|\/+$/g, "");
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  const metaUrl = `${cfg.url}/v1/${mount}/metadata/${cleanPath}`;

  try {
    const opts = await buildFetchOptions(cfg, { method: "DELETE" });
    await fetch(metaUrl, opts);
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Offloads plaintext secrets on a payload object to OpenBao KV v2 and replaces
 * the fields on the returned object with `bao:<mount>/<scopePath>#<field>` references.
 */
export async function offloadSecretsToOpenBao<T extends Record<string, any>>(
  scopePath: string,
  payload: T,
  existingRecord?: Record<string, any> | null,
  secretFields: readonly string[] = CONNECTION_SECRET_FIELDS,
  configOverride?: Partial<OpenBaoConfig>
): Promise<T> {
  const cfg = await getOpenBaoConfig(configOverride);
  const mount = cfg.mount || "secret";
  const cloned: Record<string, any> = { ...payload };
  const toWrite: Record<string, string> = {};

  for (const field of secretFields) {
    const incomingVal = cloned[field];

    if (typeof incomingVal === "string" && incomingVal.trim().length > 0) {
      if (incomingVal === "********") {
        // User left masked password unchanged on edit
        const prevVal = existingRecord?.[field];
        if (typeof prevVal === "string" && prevVal.trim().length > 0) {
          if (isVaultSecretRef(prevVal)) {
            cloned[field] = prevVal;
          } else {
            // Migrate previously cleartext secret into OpenBao!
            toWrite[field] = prevVal;
            cloned[field] = formatVaultSecretRef(mount, scopePath, field);
          }
        } else {
          delete cloned[field];
        }
      } else if (isVaultSecretRef(incomingVal)) {
        // Already a vault reference (e.g. user entered custom bao:secret/...#key)
        cloned[field] = incomingVal.trim();
      } else {
        // Plaintext secret to offload to OpenBao
        toWrite[field] = incomingVal;
        cloned[field] = formatVaultSecretRef(mount, scopePath, field);
      }
    }
  }

  if (Object.keys(toWrite).length > 0) {
    await writeVaultSecrets(scopePath, toWrite, mount, configOverride);
  }

  return cloned as T;
}

/**
 * Resolves all Vault secret references (`bao:...` or `vaultSecret(...)`) on an object
 * in-memory so executors can authenticate with the real secret values.
 */
export async function resolveObjectSecrets<T extends Record<string, any>>(
  obj: T,
  secretFields?: readonly string[],
  configOverride?: Partial<OpenBaoConfig>
): Promise<T> {
  if (!obj || typeof obj !== "object") return obj;

  const clone: Record<string, any> = { ...obj };
  const fieldsToInspect = secretFields || Object.keys(clone);

  await Promise.all(
    fieldsToInspect.map(async (field) => {
      const val = clone[field];
      if (typeof val === "string" && isVaultSecretRef(val)) {
        clone[field] = await readVaultSecret(val, configOverride);
      }
    })
  );

  // Also resolve header values if obj.headers is a record
  if (clone.headers && typeof clone.headers === "object" && !Array.isArray(clone.headers)) {
    const resolvedHeaders: Record<string, string> = { ...clone.headers };
    await Promise.all(
      Object.entries(resolvedHeaders).map(async ([k, v]) => {
        if (typeof v === "string" && isVaultSecretRef(v)) {
          resolvedHeaders[k] = await readVaultSecret(v, configOverride);
        }
      })
    );
    clone.headers = resolvedHeaders;
  }

  return clone as T;
}

/**
 * Resolves inline `bao:mount/path#key` or `vaultSecret("mount/path#key")` tokens
 * inside a string or template expression result.
 */
export async function resolveVaultRefsInText(
  text: string,
  configOverride?: Partial<OpenBaoConfig>
): Promise<string> {
  if (!text || typeof text !== "string") return text;
  if (isVaultSecretRef(text)) {
    return readVaultSecret(text, configOverride);
  }
  return text;
}
