#!/usr/bin/env bun
import { generateMasterKeyBase64 } from "../src/lib/crypto/envelope";
import { getDb, resetDbConnection } from "../src/lib/db";
import { getEncryptionInventory, rotateEncryptionKeys } from "../src/lib/crypto/rotation";

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  let mode: "rewrap" | "reencrypt" = "rewrap";

  for (const arg of argv) {
    if (arg === "--generate") flags.add("generate");
    else if (arg === "--status") flags.add("status");
    else if (arg === "--rotate") flags.add("rotate");
    else if (arg === "--dry-run") flags.add("dry-run");
    else if (arg === "--include-cleartext") flags.add("include-cleartext");
    else if (arg.startsWith("--mode=")) {
      const m = arg.slice("--mode=".length).trim().toLowerCase();
      if (m !== "rewrap" && m !== "reencrypt") {
        console.error(`Invalid --mode="${m}". Expected "rewrap" or "reencrypt".`);
        process.exit(1);
      }
      mode = m;
    } else if (arg === "--help" || arg === "-h") {
      flags.add("help");
    }
  }

  return {
    generate: flags.has("generate"),
    status: flags.has("status"),
    dryRun: flags.has("dry-run"),
    includeLegacyCleartext: flags.has("include-cleartext"),
    help: flags.has("help"),
    mode,
  };
}

function printHelp() {
  console.log(`SolidFlow Envelope Encryption Key Management CLI

Usage:
  bun scripts/rotate-keys.ts --generate                  Generate a new 256-bit AES-GCM master key (base64)
  bun scripts/rotate-keys.ts --status                    Show configured key versions and DB record inventory
  bun scripts/rotate-keys.ts [options]                   Rotate records to ENCRYPTION_ACTIVE_KEY_VERSION

Options:
  --mode=rewrap|reencrypt   Rotation mode (default: rewrap = fast DEK re-wrap; reencrypt = new DEKs + IVs)
  --include-cleartext       Also encrypt legacy cleartext DB connections
  --dry-run                 Preview changes without writing to SurrealDB
  -h, --help                Show this help
`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.generate) {
    const key = generateMasterKeyBase64();
    console.log("Generated 256-bit (32-byte) Master Key (Base64):\n");
    console.log(`ENCRYPTION_MASTER_KEY_V1="${key}"`);
    console.log(`ENCRYPTION_ACTIVE_KEY_VERSION="v1"`);
    console.log("\nFor rotation, keep old version(s) configured and add the next version:");
    console.log(`# ENCRYPTION_MASTER_KEY_V2="${key}"`);
    console.log(`# ENCRYPTION_ACTIVE_KEY_VERSION="v2"`);
    process.exit(0);
  }

  const db = await getDb();
  try {
    if (opts.status) {
      const report = await getEncryptionInventory(db);
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    }

    const summary = await rotateEncryptionKeys(db, {
      mode: opts.mode,
      includeLegacyCleartext: opts.includeLegacyCleartext,
      dryRun: opts.dryRun,
    });

    console.log(JSON.stringify(summary, null, 2));
    if (!summary.ok) {
      process.exit(1);
    }
    process.exit(0);
  } finally {
    resetDbConnection();
  }
}

main().catch((err: any) => {
  console.error("[rotate-keys] Error:", err?.message || err);
  resetDbConnection();
  process.exit(1);
});
