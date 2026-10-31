import { getSession } from "@auth/solid-start";
import { RecordId } from "surrealdb";
import { authOpts } from "~/routes/api/auth/[...solidauth]";
import { createDynamicRequest } from "~/lib/authUrl";
import {
  buildAccessContext,
  extractPlatformRoleFromClaims,
  formatGroupClaim,
  normalizeGroupName,
  normalizePlatformRole,
  type EffectiveAccessContext,
  type PlatformRole,
} from "~/lib/groupAuth";

export interface AuthUser {
  sub: string;
  name?: string;
  username?: string;
  email?: string;
  image?: string;
  idpGroups: string[];
  sessionId?: string;
  jwtClaims?: Record<string, any> | null;
  jwtHeader?: Record<string, any> | null;
}

/**
 * Extract the authenticated user from a request, or return null if not logged in.
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  try {
    const { request: dynamicReq } = createDynamicRequest(request, false);
    const session = await getSession(dynamicReq, authOpts);
    if (!session?.user) return null;
    const user = session.user as any;
    const sub = user.sub || user.id || "anonymous";
    return {
      sub,
      name: user.name || undefined,
      username: user.username || user.name || sub,
      email: user.email || undefined,
      image: user.image || undefined,
      idpGroups: Array.isArray(user.idpGroups) ? user.idpGroups : [],
      sessionId: user.sessionId || "default",
      jwtClaims: user.jwtClaims || null,
      jwtHeader: user.jwtHeader || null,
    };
  } catch {
    return null;
  }
}

/**
 * Get the owner ID string from a request, falling back to "anonymous".
 */
export async function getOwnerFromRequest(request: Request): Promise<string> {
  const user = await getAuthUser(request);
  return user?.sub || "anonymous";
}

/**
 * Resolve the user's full EffectiveAccessContext:
 * - Platform role (admin, creator, user, viewer) comes from FerrisKey OIDC claims (or admin override in SurrealDB).
 * - Spaces/groups and fine-grained rights (view, use, write, delete, manager) come from SurrealDB.
 */
export async function getEffectiveAccessContext(
  request: Request,
  db?: any
): Promise<EffectiveAccessContext> {
  const user = await getAuthUser(request);
  if (!user || !user.sub || user.sub === "anonymous") {
    return buildAccessContext({ sub: "anonymous", idpRole: "viewer" });
  }

  let idpRole: PlatformRole = extractPlatformRoleFromClaims(user.idpGroups, "viewer");
  let simulatedRole: PlatformRole | null = null;
  let disabledGroups: string[] = [];
  let disableOwnerBypass = false;
  const dbClaims: string[] = [];
  const sessionClaims: string[] = [];
  const taggedGroups = new Set<string>();

  if (db) {
    try {
      const profileId = new RecordId("user_profile", user.sub);
      const profileRes = await db.select(profileId);
      const profile = Array.isArray(profileRes) ? profileRes[0] : profileRes;
      if (profile) {
        if (Array.isArray(profile.disabledGroups)) {
          disabledGroups = profile.disabledGroups;
        }
        if (typeof profile.disableOwnerBypass === "boolean") {
          disableOwnerBypass = profile.disableOwnerBypass;
        }
        if (profile.simulatedRole) {
          simulatedRole = normalizePlatformRole(profile.simulatedRole);
        }
        const overrideRole = normalizePlatformRole(profile.roleOverride);
        if (overrideRole) {
          idpRole = overrideRole;
        }
        if (Array.isArray(profile.groupGrants)) {
          for (const g of profile.groupGrants) {
            if (typeof g === "string" && g.trim()) {
              dbClaims.push(g.trim());
            } else if (g && typeof g.claim === "string") {
              dbClaims.push(g.claim);
            }
          }
        }
        if (Array.isArray(profile.sessionGrants)) {
          for (const g of profile.sessionGrants) {
            if (g && typeof g.claim === "string") {
              dbClaims.push(g.claim);
            }
          }
        }
      }

      // Keep user_profile synced with basic user identity, FerrisKey role, and latest parsed JWT claims
      const cleanUsername = (user.username || user.name || user.sub).trim();
      const needsProfileSync =
        !profile ||
        profile.username !== cleanUsername ||
        profile.idpRole !== idpRole ||
        (user.email && profile.email !== user.email) ||
        (user.jwtClaims && !profile.lastJwtClaims);

      if (needsProfileSync) {
        const mergeData: Record<string, any> = {
          sub: user.sub,
          username: cleanUsername,
          name: user.name || cleanUsername,
          email: user.email || "",
          idpRole,
          updated_at: new Date().toISOString(),
        };
        if (user.jwtClaims) {
          mergeData.lastJwtClaims = user.jwtClaims;
        }
        if (user.jwtHeader) {
          mergeData.lastJwtHeader = user.jwtHeader;
        }
        await db
          .query(`UPSERT $profile MERGE $mergeData;`, {
            profile: profileId,
            mergeData,
          })
          .catch(() => {});
      }
    } catch {
      // user_profile table might not exist yet
    }

    // Load space/group memberships assigned to this user in SurrealDB (group_member table)
    try {
      const usernameLower = (user.username || user.name || "").trim().toLowerCase();
      const emailLower = (user.email || "").trim().toLowerCase();
      const subLower = user.sub.trim().toLowerCase();

      const memberRes = await db.query(
        `SELECT * FROM group_member WHERE
          userSub = $sub
          OR string::lowercase(username ?? '') = $usernameLower
          OR ($emailLower != '' AND string::lowercase(username ?? '') = $emailLower)
          OR string::lowercase(username ?? '') = $subLower;`,
        {
          sub: user.sub,
          usernameLower,
          emailLower,
          subLower,
        }
      );
      const memberRows = Array.isArray(memberRes)
        ? Array.isArray(memberRes[0])
          ? memberRes[0]
          : memberRes
        : [];
      for (const m of memberRows) {
        if (m && m.group) {
          const rights = Array.isArray(m.rights)
            ? m.rights
            : typeof m.rights === "string"
              ? m.rights
              : ["view", "use"];
          dbClaims.push(formatGroupClaim(String(m.group), rights));
        }
      }
    } catch {
      // group_member table might not exist yet
    }

    // Also include spaces owned by this user in group_namespace as :manager
    try {
      const ownedRes = await db.query(
        `SELECT name FROM group_namespace WHERE owner = $owner;`,
        { owner: user.sub }
      );
      const ownedRows = Array.isArray(ownedRes)
        ? Array.isArray(ownedRes[0])
          ? ownedRes[0]
          : ownedRes
        : [];
      for (const row of ownedRows) {
        if (row?.name) {
          dbClaims.push(`${normalizeGroupName(String(row.name))}:manager`);
        }
      }
    } catch {
      // group_namespace table might not exist yet
    }

    // Collect groups that this user has tagged on their own resources so they can simulate them
    const tagTables = ["dashboard", "workflow", "connection", "database_meta", "proto_file", "ca_cert"];
    await Promise.allSettled(
      tagTables.map(async (tbl) => {
        try {
          const tableRes = await db.query(`SELECT tags FROM ${tbl} WHERE owner = $owner;`, { owner: user.sub });
          const rows = Array.isArray(tableRes) ? (Array.isArray(tableRes[0]) ? tableRes[0] : tableRes) : [];
          for (const row of rows) {
            if (row && Array.isArray(row.tags)) {
              for (const t of row.tags) {
                const norm = normalizeGroupName(String(t).split(":")[0] || "");
                if (norm) taggedGroups.add(norm);
              }
            }
          }
        } catch {
          // Table might not exist yet or cannot be queried
        }
      })
    );
  }

  return buildAccessContext({
    sub: user.sub,
    username: user.username || user.name || user.sub,
    email: user.email,
    idpRole,
    simulatedRole,
    dbClaims,
    sessionClaims,
    taggedGroups: [...taggedGroups],
    disabledGroups,
    disableOwnerBypass,
  });
}
