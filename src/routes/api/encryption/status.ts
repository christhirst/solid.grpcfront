import type { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { getEffectiveAccessContext } from "~/lib/auth";
import { getEncryptionInventory } from "~/lib/crypto/rotation";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canManageConnections && !ctx.isAdmin) {
      return Response.json(
        {
          error:
            ctx.sub === "anonymous"
              ? "Authentication with Creator or Admin role is required to view encryption status."
              : "Creator or Admin role is required to view encryption status.",
        },
        { status: ctx.sub === "anonymous" ? 401 : 403 }
      );
    }

    const inventory = await getEncryptionInventory(db);
    return Response.json({
      ...inventory,
      isAdmin: Boolean(ctx.isAdmin),
    });
  } catch (err: any) {
    return Response.json(
      {
        configured: false,
        activeKeyVersion: null,
        availableVersions: [],
        error: err?.message || "Failed to inspect encryption status",
      },
      { status: 500 }
    );
  }
}
