#!/bin/bash

# Determine if we should wrap with varlock run (e.g. if OpenBao/Vault is configured or requested)
if [ "$VARLOCK_RUN" = "true" ] || [ "$VARLOCK_RUN" = "1" ] || ([ -n "$VAULT_ADDR" ] && [ -f "./.env.schema" ]); then
  echo "🔒 Starting SolidFlow with OpenBao / Varlock runtime resolution..."
  exec bun ./node_modules/varlock/bin/varlock.js run -- bun --import ./.output/server/instrument.server.mjs .output/server/index.mjs
else
  exec bun --import ./.output/server/instrument.server.mjs .output/server/index.mjs
fi