import { RecordId } from "surrealdb";
import {
  CONNECTION_SECRET_FIELDS,
  getCredentialSecuritySummary,
  isEncryptedSecretValue,
  isVaultSecretRef,
} from "~/lib/vaultRef";
import {
  canonicalizeRecordId,
  getEncryptionStatus,
  rotateRecordEnvelope,
  type EncryptionStatusInfo,
  type KeyRotationMode,
} from "./envelope";

export interface EncryptionInventoryStats {
  totalConnections: number;
  encryptedActiveCount: number;
  outdatedKeyCount: number;
  legacyCleartextCount: number;
  openbaoCount: number;
  noSecretsCount: number;
  byKeyVersion: Record<string, number>;
  vaultConfigEncrypted: boolean;
  vaultConfigHasCleartext: boolean;
  vaultConfigKeyVersion: string | null;
  vaultConfigNeedsRotation: boolean;
}

export interface EncryptionInventoryReport extends EncryptionStatusInfo {
  stats: EncryptionInventoryStats;
}

export interface KeyRotationSummary {
  ok: boolean;
  mode: KeyRotationMode;
  dryRun: boolean;
  activeKeyVersion: string;
  rotatedCount: number;
  migratedCleartextCount: number;
  skippedCount: number;
  vaultConfigRotated: boolean;
  failed: Array<{ id: string; error: string }>;
  remainingOutdatedCount: number;
}

/**
 * Inspects keyring configuration and SurrealDB records to report key-version distribution
 * and whether any connections or `vault_config:main` require rotation or legacy migration.
 */
export async function getEncryptionInventory(db: any): Promise<EncryptionInventoryReport> {
  const encStatus = getEncryptionStatus();
  const byKeyVersion: Record<string, number> = {};

  let totalConnections = 0;
  let encryptedActiveCount = 0;
  let outdatedKeyCount = 0;
  let legacyCleartextCount = 0;
  let openbaoCount = 0;
  let noSecretsCount = 0;

  if (db) {
    try {
      const fieldsSql = ["id", "key_version", "secretStorage", ...CONNECTION_SECRET_FIELDS].join(", ");
      const res = await db.query(`SELECT ${fieldsSql} FROM connection`);
      const rows = (Array.isArray(res?.[0]) ? res[0] : []) as Array<Record<string, any>>;

      for (const row of rows) {
        totalConnections++;
        const summary = getCredentialSecuritySummary(row, CONNECTION_SECRET_FIELDS);

        if (summary.status === "openbao") {
          openbaoCount++;
          continue;
        }
        if (summary.status === "none") {
          noSecretsCount++;
          continue;
        }
        if (summary.cleartextFields.length > 0) {
          legacyCleartextCount++;
          continue;
        }

        // Encrypted in DB
        const ver = typeof row.key_version === "string" && row.key_version.trim()
          ? row.key_version.trim()
          : "unknown";
        byKeyVersion[ver] = (byKeyVersion[ver] || 0) + 1;

        if (encStatus.activeKeyVersion && ver === encStatus.activeKeyVersion) {
          encryptedActiveCount++;
        } else {
          outdatedKeyCount++;
        }
      }
    } catch (e: any) {
      if (!e?.message?.includes("does not exist")) throw e;
    }
  }

  let vaultConfigEncrypted = false;
  let vaultConfigHasCleartext = false;
  let vaultConfigKeyVersion: string | null = null;
  let vaultConfigNeedsRotation = false;

  if (db) {
    try {
      const vcRes = await db.select(new RecordId("vault_config", "main")).catch(() => null);
      const vc = Array.isArray(vcRes) ? vcRes[0] : vcRes;
      if (vc && typeof vc.token === "string" && vc.token.trim().length > 0 && !isVaultSecretRef(vc.token)) {
        vaultConfigEncrypted = isEncryptedSecretValue(vc.token);
        vaultConfigHasCleartext = !vaultConfigEncrypted;
        vaultConfigKeyVersion = typeof vc.key_version === "string" ? vc.key_version : null;
        vaultConfigNeedsRotation =
          vaultConfigHasCleartext ||
          Boolean(
            vaultConfigEncrypted &&
              encStatus.activeKeyVersion &&
              vaultConfigKeyVersion !== encStatus.activeKeyVersion
          );
      }
    } catch {}
  }

  return {
    ...encStatus,
    stats: {
      totalConnections,
      encryptedActiveCount,
      outdatedKeyCount,
      legacyCleartextCount,
      openbaoCount,
      noSecretsCount,
      byKeyVersion,
      vaultConfigEncrypted,
      vaultConfigHasCleartext,
      vaultConfigKeyVersion,
      vaultConfigNeedsRotation,
    },
  };
}

/**
 * Batch-rotates envelope encryption across outdated `connection` records (via indexed `key_version`)
 * and `vault_config:main`, optionally migrating legacy cleartext connections.
 */
export async function rotateEncryptionKeys(
  db: any,
  options?: {
    mode?: KeyRotationMode;
    includeLegacyCleartext?: boolean;
    dryRun?: boolean;
  }
): Promise<KeyRotationSummary> {
  const mode: KeyRotationMode = options?.mode === "reencrypt" ? "reencrypt" : "rewrap";
  const includeLegacyCleartext = Boolean(options?.includeLegacyCleartext);
  const dryRun = Boolean(options?.dryRun);

  const encStatus = getEncryptionStatus();
  if (!encStatus.configured || !encStatus.activeKeyVersion) {
    throw new Error(
      encStatus.error ||
        "Envelope encryption master key is not configured. Run 'bun run keys:generate' and set ENCRYPTION_MASTER_KEY_V1 (or ENCRYPTION_MASTER_KEYS)."
    );
  }

  const activeVersion = encStatus.activeKeyVersion;
  const candidateMap = new Map<string, Record<string, any>>();

  // 1. Fetch DB-encrypted candidate connections using `idx_connection_key_version`
  try {
    const querySql =
      mode === "reencrypt"
        ? "SELECT * FROM connection WHERE key_version != NONE"
        : "SELECT * FROM connection WHERE key_version != NONE AND key_version != $activeVersion";
    const encRes = await db.query(querySql, { activeVersion });
    const rows = (Array.isArray(encRes?.[0]) ? encRes[0] : []) as Array<Record<string, any>>;
    for (const row of rows) {
      const cid = canonicalizeRecordId(row.id);
      if (cid) candidateMap.set(cid, row);
    }
  } catch (e: any) {
    if (!e?.message?.includes("does not exist")) throw e;
  }

  // 2. Optionally include legacy cleartext (or mixed unversioned) records
  if (includeLegacyCleartext || mode === "reencrypt") {
    try {
      const unversionedRes = await db.query("SELECT * FROM connection WHERE key_version = NONE");
      const rows = (Array.isArray(unversionedRes?.[0]) ? unversionedRes[0] : []) as Array<
        Record<string, any>
      >;
      for (const row of rows) {
        const cid = canonicalizeRecordId(row.id);
        if (cid && !candidateMap.has(cid)) {
          candidateMap.set(cid, row);
        }
      }
    } catch (e: any) {
      if (!e?.message?.includes("does not exist")) throw e;
    }
  }

  let rotatedCount = 0;
  let migratedCleartextCount = 0;
  let skippedCount = 0;
  const failed: Array<{ id: string; error: string }> = [];

  for (const [canonicalId, conn] of candidateMap.entries()) {
    try {
      const result = rotateRecordEnvelope(conn, {
        mode,
        includeLegacyCleartext,
        secretFields: CONNECTION_SECRET_FIELDS,
        explicitRecordId: canonicalId,
      });

      if (!result.changed) {
        skippedCount++;
        continue;
      }

      if (!dryRun) {
        const cleanId = canonicalId.includes(":") ? canonicalId.split(":").slice(1).join(":") : canonicalId;
        const patch: Record<string, any> = {
          encrypted_dek: result.updated.encrypted_dek,
          key_version: result.updated.key_version,
          key_rotated_at: result.updated.key_rotated_at,
          updated_at: new Date().toISOString(),
        };

        if (result.action !== "rewrapped") {
          for (const field of CONNECTION_SECRET_FIELDS) {
            if (result.updated[field] !== undefined) {
              patch[field] = result.updated[field];
            }
          }
          if (result.updated.tokenBody !== conn.tokenBody) {
            patch.tokenBody = result.updated.tokenBody;
          }
          if (!conn.secretStorage || conn.secretStorage === "db") {
            patch.secretStorage = "db";
          }
        }

        await db.query("UPDATE $id MERGE $data", {
          id: new RecordId("connection", cleanId),
          data: patch,
        });
      }

      if (result.action === "encrypted_cleartext") {
        migratedCleartextCount++;
      } else {
        rotatedCount++;
      }
    } catch (err: any) {
      failed.push({
        id: canonicalId,
        error: err?.message || "Failed to rotate connection keys",
      });
    }
  }

  // 3. Rotate vault_config:main token if stored in SurrealDB
  let vaultConfigRotated = false;
  try {
    const vcRes = await db.select(new RecordId("vault_config", "main")).catch(() => null);
    const vc = Array.isArray(vcRes) ? vcRes[0] : vcRes;
    if (vc && typeof vc.token === "string" && vc.token.trim().length > 0 && !isVaultSecretRef(vc.token)) {
      const vcResult = rotateRecordEnvelope(
        { ...vc, id: "vault_config:main" },
        {
          mode,
          includeLegacyCleartext,
          secretFields: ["token"],
          explicitRecordId: "vault_config:main",
        }
      );

      if (vcResult.changed) {
        if (!dryRun) {
          const patch: Record<string, any> = {
            encrypted_dek: vcResult.updated.encrypted_dek,
            key_version: vcResult.updated.key_version,
            key_rotated_at: vcResult.updated.key_rotated_at,
            updatedAt: new Date().toISOString(),
          };
          if (vcResult.action !== "rewrapped") {
            patch.token = vcResult.updated.token;
          }
          await db.query("UPDATE vault_config:main MERGE $data", { data: patch });
          try {
            const { clearOpenBaoCaches } = await import("~/lib/openbao");
            clearOpenBaoCaches();
          } catch {}
        }
        vaultConfigRotated = true;
      }
    }
  } catch (err: any) {
    failed.push({
      id: "vault_config:main",
      error: err?.message || "Failed to rotate vault_config:main token",
    });
  }

  // 4. Count any remaining outdated encrypted connections
  let remainingOutdatedCount = 0;
  try {
    const remRes = await db.query(
      "SELECT count() FROM connection WHERE key_version != NONE AND key_version != $activeVersion GROUP ALL",
      { activeVersion }
    );
    remainingOutdatedCount = Number(remRes?.[0]?.[0]?.count ?? 0);
  } catch {}

  return {
    ok: failed.length === 0,
    mode,
    dryRun,
    activeKeyVersion: activeVersion,
    rotatedCount,
    migratedCleartextCount,
    skippedCount,
    vaultConfigRotated,
    failed,
    remainingOutdatedCount,
  };
}
