import type { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getAuthUser, getEffectiveAccessContext } from "~/lib/auth";
import { getDb } from "~/lib/db";
import {
  ensurePublishingSchema,
  getUserProfile,
  saveUserNamespace,
  publishingErrorResponse,
} from "~/lib/dashboard/publishing";
import {
  normalizeGroupName,
  normalizePlatformRole,
} from "~/lib/groupAuth";
import { readJsonBody } from "~/lib/requestUtils";

async function buildFullProfilePayload(request: Request, db: any, sub: string) {
  const [{ namespace }, ctx, user, profileRes] = await Promise.all([
    getUserProfile(db, sub),
    getEffectiveAccessContext(request, db),
    getAuthUser(request),
    db.select(new RecordId("user_profile", sub)).catch(() => null),
  ]);
  const profileRecord = Array.isArray(profileRes) ? profileRes[0] : profileRes;
  const jwtClaims = user?.jwtClaims || profileRecord?.lastJwtClaims || null;
  const jwtHeader = user?.jwtHeader || profileRecord?.lastJwtHeader || null;

  return {
    namespace,
    user: {
      sub,
      name: user?.name || user?.username || sub,
      username: user?.username || user?.name || sub,
      email: user?.email,
      image: user?.image,
    },
    idpRole: ctx.idpRole,
    platformRole: ctx.platformRole,
    simulatedRole: ctx.simulatedRole,
    capabilities: ctx.capabilities,
    allGrants: ctx.allGrants,
    activeGrants: ctx.activeGrants,
    disabledGroups: ctx.disabledGroups,
    disableOwnerBypass: ctx.disableOwnerBypass,
    isAdmin: ctx.isAdmin,
    hasAdminClaim: ctx.hasAdminClaim,
    isSimulating: ctx.isSimulating,
    jwtClaims,
    jwtHeader,
  };
}

export async function GET(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  try {
    const db = await getDb();
    const data = await buildFullProfilePayload(event.request, db, user.sub);
    return Response.json({ success: true, data });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}

export async function PUT(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  try {
    const db = await getDb();
    await ensurePublishingSchema(db);
    const body = await readJsonBody(event);

    if (body.namespace !== undefined) {
      await saveUserNamespace(db, user.sub, body.namespace);
    }

    if (body.resetSimulation === true) {
      await db.query(
        `UPSERT $profile MERGE { disabledGroups: [], disableOwnerBypass: false, simulatedRole: NONE, updated_at: $now };`,
        {
          profile: new RecordId("user_profile", user.sub),
          now: new Date().toISOString(),
        }
      );
    } else if (
      body.disabledGroups !== undefined ||
      body.disableOwnerBypass !== undefined ||
      body.simulatedRole !== undefined
    ) {
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (Array.isArray(body.disabledGroups)) {
        patch.disabledGroups = body.disabledGroups
          .map((g: unknown) => normalizeGroupName(String(g)))
          .filter(Boolean);
      }
      if (typeof body.disableOwnerBypass === "boolean") {
        patch.disableOwnerBypass = body.disableOwnerBypass;
      }
      if (body.simulatedRole !== undefined) {
        patch.simulatedRole = normalizePlatformRole(body.simulatedRole) || null;
      }
      await db.query(`UPSERT $profile MERGE $patch;`, {
        profile: new RecordId("user_profile", user.sub),
        patch,
      });
    }

    const data = await buildFullProfilePayload(event.request, db, user.sub);
    return Response.json({ success: true, data });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
