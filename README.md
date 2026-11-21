# SolidFlow (`solid.grpcfront`)

SolidFlow is an end-to-end platform to display data, automate workflows, and transform information across HTTP/REST, gRPC, SurrealDB, and S3 systems, powered by [`solid-start`](https://start.solidjs.com) and [Bun](https://bun.sh).

## Developing

Install dependencies and start the development server with Bun:

```bash
bun install
bun dev
```

## Building & Running

Build the application for production using Nitro's Bun preset:

```bash
bun run build
```

Run the built production server:

```bash
# Using the startup script with Sentry & URL patch instrumentation:
./start.sh

# Or directly:
bun --import ./.output/server/instrument.server.mjs .output/server/index.mjs
```

---

## Connection Secret Encryption (Envelope Encryption & Key Rotation)

When storing connection credentials (`password`, `bearerToken`, `tokenPassword`, `tokenBearerToken`, `tokenClientSecret`, `secretAccessKey`, `sessionToken`) or the OpenBao server token (`vault_config:main.token`) in SurrealDB (`secretStorage: "db"`), SolidFlow protects secrets using **two-tier AES-256-GCM Envelope Encryption** (`src/lib/crypto/envelope.ts`). You can also store connection secrets externally in **OpenBao / HashiCorp Vault KV v2** (`secretStorage: "openbao"`).

### Security Model & Storage Format

1. **Master Key (KEK — Key Encryption Key):** 256-bit (32-byte) key(s) loaded strictly from environment variables / Varlock outside SurrealDB, identified by version (`v1`, `v2`, ...).
2. **Per-Record Data Encryption Key (DEK):** Every encrypted record gets its own cryptographically random 256-bit DEK (`crypto.randomBytes(32)`), wrapped using `crypto.createCipheriv("aes-256-gcm", kek, iv, { authTagLength: 16 })` and stored on the record in `encrypted_dek` (`dek:aes256gcm:<iv_b64url>:<tag_b64url>:<ct_b64url>`).
3. **Unique 96-bit Nonce/IV Every Encryption:** A fresh 12-byte random IV (`crypto.randomBytes(12)`) is generated for every DEK wrap and every individual secret field (`enc:aes256gcm:<iv_b64url>:<tag_b64url>:<ct_b64url>`).
4. **AAD Tamper & Swap Binding:**
   - Wrapped DEKs bind Additional Authenticated Data: `solidflow:dek:<recordId>:<key_version>`.
   - Encrypted secret fields bind Additional Authenticated Data: `solidflow:field:<recordId>:<fieldName>`.
   - Copying ciphertexts across connections, across fields, or modifying `key_version` without re-wrapping fails GCM authentication immediately.
5. **Indexed `key_version` Column:** Each encrypted SurrealDB record stores `key_version` (e.g., `"v1"`, `"v2"`), indexed via `idx_connection_key_version` for fast rotation queries.
6. **API Masking & Fail-Closed Writes:**
   - `GET /api/connections` and `GET /api/connections/:id` strip `encrypted_dek` and mask DB secret values with `"********"`.
   - When no Master Key is configured, reading legacy cleartext connections continues to work for backward compatibility, while saving new DB-stored secrets **fails closed** (set `ALLOW_CLEARTEXT_DB_SECRETS=true` in non-production only if plaintext local dev storage is explicitly needed).

### Quick Start: Configure Master Key `v1`

1. Generate a 256-bit master key:

```bash
bun run keys:generate
```

2. Add the output to your `.env` (or configure via Varlock / Kubernetes Secret / OpenBao `vaultSecret(...)` — see `.env.schema` and `.env.openbao.example`):

```env
ENCRYPTION_MASTER_KEY_V1="<generated-base64-32-byte-key>"
ENCRYPTION_ACTIVE_KEY_VERSION="v1"
```

Alternatively, supply a multi-version keyring string:

```env
ENCRYPTION_MASTER_KEYS="v1:<key1>,v2:<key2>"
ENCRYPTION_ACTIVE_KEY_VERSION="v2"
```

*(Accepts 44-char Base64, 43-char Base64URL, or 64-char Hex 32-byte keys.)*

### Zero-Downtime Key Rotation Runbook (`v1` -> `v2`)

1. **Generate the new master key:**

```bash
bun run keys:generate
```

2. **Deploy both keys together with `v2` set active (do NOT remove `v1` yet):**

```env
ENCRYPTION_MASTER_KEY_V1="<old-v1-key>"
ENCRYPTION_MASTER_KEY_V2="<new-v2-key>"
ENCRYPTION_ACTIVE_KEY_VERSION="v2"
```

At this stage, existing `v1` connections continue decrypting seamlessly with `v1`, while new or edited connections automatically write under `v2`.

3. **Preview & execute rotation** via CLI (or via the **DB Encryption** modal in `/connections` as an Admin):

```bash
# Inspect current key_version breakdown in SurrealDB
bun run keys:status

# Preview rotation without writing to SurrealDB
bun run keys:rotate --dry-run

# Fast rotation (default): re-wraps DEKs with KEK v2 + fresh 12B IV, updates key_version="v2"
bun run keys:rotate

# Full rotation: generates brand-new 32B DEKs and fresh IVs for every field + wraps with KEK v2
bun run keys:rotate --mode=reencrypt

# Optional: also encrypt any legacy unencrypted DB records during rotation
bun run keys:rotate --include-cleartext
```

4. **Verify all records are on `v2`, then retire `v1`:**

```bash
bun run keys:status
```

Once `outdatedKeyCount` and `remainingOutdatedCount` are `0`, remove `ENCRYPTION_MASTER_KEY_V1` from `.env` / secrets manager.

### Admin API Endpoints & OpenBao Coexistence

- `GET /api/encryption/status`: Returns keyring metadata (`configured`, `activeKeyVersion`, `availableVersions` — never key material) and SurrealDB counts grouped by `key_version`, legacy cleartext, and OpenBao Vault.
- `POST /api/encryption/rotate` (**Admin-only**): Accepts `{ "mode": "rewrap" | "reencrypt", "includeLegacyCleartext": boolean, "dryRun": boolean }`.
- **OpenBao KV v2 Coexistence:** Connections with `secretStorage: "openbao"` continue storing `bao:<mount>/<path>#<field>` references in SurrealDB; migrating an AES-256-GCM encrypted connection to OpenBao (`POST /api/vault` `action: "migrate_all"` or switching storage mode in `/connections`) decrypts the secret in memory before storing plaintext in OpenBao and removes `encrypted_dek` / `key_version` from the DB record.

---

## Testing

Run the unit test suite with Bun:

```bash
bun test
```

