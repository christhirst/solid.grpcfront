import type { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { getEffectiveAccessContext } from "~/lib/auth";
import { readJsonBody } from "~/lib/requestUtils";
import { rotateEncryptionKeys } from "~/lib/crypto/rotation";
import { getEncryptionStatus } from "~/lib/crypto/envelope";

export async function POST(event: APIEvent) {
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.isAdmin) {
      return Response.json(
        {
          success: false,
          error:
            ctx.sub === "anonymous"
              ? "Authentication with Admin role is required to rotate encryption keys."
              : "Admin role is required to rotate encryption keys.",
        },
        { status: ctx.sub === "anonymous" ? 401 : 403 }
      );
    }

    const encStatus = getEncryptionStatus();
    if (!encStatus.configured) {
      return Response.json(
        {
          success: false,
          error:
            encStatus.error ||
            "Envelope encryption master key is not configured. Run 'bun run keys:generate' and configure ENCRYPTION_MASTER_KEY_V1.",
        },
        { status: 400 }
      );
    }

    const body = (await readJsonBody(event).catch(() => ({}))) || {};
    const mode = body.mode === "reencrypt" ? "reencrypt" : "rewrap";
    const includeLegacyCleartext = Boolean(body.includeLegacyCleartext);
    const dryRun = Boolean(body.dryRun);

    const summary = await rotateEncryptionKeys(db, {
      mode,
      includeLegacyCleartext,
      dryRun,
    });

    return Response.json(
      {
        ...summary,
        success: summary.ok,
      },
      { status: summary.ok ? 200 : 207 }
    );
  } catch (err: any) {
    return Response.json(
      {
        success: false,
        ok: false,
        error: err?.message || "Key rotation failed",
      },
      { status: 500 }
    );
  }
}
