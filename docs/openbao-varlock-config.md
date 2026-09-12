# Using OpenBao & HashiCorp Vault with Varlock for SolidFlow

This guide explains how to manage environment variables and secrets in **SolidFlow** using **OpenBao** (or HashiCorp Vault) and [Varlock](https://varlock.dev).

---

## Overview

SolidFlow utilizes `varlock` with the `@varlock/hashicorp-vault-plugin` to:
- Define declarative schemas for environment variables with `@sensitive` redaction and type validation in `.env.schema`.
- Load secrets dynamically from OpenBao / Vault at startup into `process.env`.
- Keep sensitive secrets away from terminal logs and AI assistants.

---

## 1. Prerequisites

- **OpenBao CLI** (`bao`) or **Vault CLI** (`vault`).
- An active OpenBao or HashiCorp Vault instance (e.g. running on `http://127.0.0.1:8200` or a remote cluster).

---

## 2. Authentication Methods

Varlock automatically supports multiple authentication methods in this priority order:

### A. Local Developer CLI Login (Recommended for dev)
If you run `bao login` or `vault login`, Varlock automatically discovers and uses the token stored in:
- `~/.bao-token` (OpenBao)
- `~/.vault-token` (Vault)

No token needs to be stored in your `.env` files.

### B. Explicit Token
Provide a token directly in your `.env.local`:
```bash
VAULT_TOKEN="s.xyz..."
```

### C. AppRole (Recommended for CI/CD & Production)
1. Enable AppRole in OpenBao:
   ```bash
   bao auth enable approle
   ```
2. Configure AppRole credentials in your environment:
   ```bash
   VAULT_ROLE_ID="<role-id-uuid>"
   VAULT_SECRET_ID="<secret-id-uuid>"
   ```

---

## 3. Storing Secrets in OpenBao

Enable a KV version 2 secrets engine (if not already enabled) and write your SolidFlow secrets:

```bash
# Enable KV v2 at 'secret/'
bao secrets enable -path=secret kv-v2

# Store credentials for SolidFlow
bao kv put secret/solidflow \
  SURREALDB_PASS="your-surrealdb-password" \
  AUTH_SECRET="your-32-char-random-secret" \
  OIDC_CLIENT_SECRET="your-oidc-client-secret"
```

---

## 4. Referencing Secrets in SolidFlow

In `.env.local`, reference secrets using `vaultSecret("<path>#<key>")`:

```env
VAULT_ADDR="http://127.0.0.1:8200"

SURREALDB_PASS=vaultSecret("secret/solidflow#SURREALDB_PASS")
AUTH_SECRET=vaultSecret("secret/solidflow#AUTH_SECRET")
OIDC_CLIENT_SECRET=vaultSecret("secret/solidflow#OIDC_CLIENT_SECRET")
```

---

## 5. Useful Varlock Commands

Validate configuration and inspect resolved values:
```bash
bun run varlock:load
```

Scan codebase for any plaintext secret leaks:
```bash
bun run varlock:scan
```

Run application commands inside the Varlock environment wrapper:
```bash
bunx varlock run -- bun run dev
bunx varlock run -- bun run build
```

---

## 6. Kubernetes & Docker Runtime

SolidFlow is designed to support both native Kubernetes configuration (standard `process.env`) and dynamic OpenBao/Vault resolution at runtime:

### Option A: Standard Kubernetes Secrets (Default)
When deploying with Helm, Kustomize, or Kubernetes Secrets/ConfigMaps, variables are injected directly into the container pod environment. SolidFlow runs seamlessly without needing any external secret resolver:
```yaml
env:
  - name: SURREALDB_URL
    value: "wss://..."
  - name: SURREALDB_PASS
    valueFrom:
      secretKeyRef:
        name: solidflow-secrets
        key: SURREALDB_PASS
```

### Option B: Runtime Resolution with OpenBao & Varlock
To resolve secrets from OpenBao at container startup:
1. Provide `VAULT_ADDR` and authentication credentials (`VAULT_ROLE_ID` and `VAULT_SECRET_ID`, or `VAULT_TOKEN`) in the pod environment.
2. Set `VARLOCK_RUN=true` or use `start.sh` as the container entrypoint.
3. The entrypoint script will invoke `varlock run`, automatically populating secrets from OpenBao before launching the server.

