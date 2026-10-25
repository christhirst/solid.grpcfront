import { getSession } from "@auth/solid-start";
import { RecordId } from "surrealdb";
import { authOpts } from "~/routes/api/auth/[...solidauth]";
import { createDynamicRequest } from "~/lib/authUrl";
import {
  buildAccessContext,
  normalizeGroupName,
  type EffectiveAccessContext,
} from "~/lib/groupAuth";

export interface AuthUser {
  sub: string;
  name?: string;
  username?: string;
  email?: string;
  image?: string;
  idpGroups: string[];
  sessionId?: string;
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
 * Resolve the user's full EffectiveAccessContext (combining IdP JWT groups, current session manager grants,
 * groups tagged on the user's own resources, and active/deactivated group simulation state).
 */
export async function getEffectiveAccessContext(
  request: Request,
  db?: any
): Promise<EffectiveAccessContext> {
  const user = await getAuthUser(request);
  if (!user || !user.sub || user.sub === "anonymous") {
    return buildAccessContext({ sub: "anonymous" });
  }

  let disabledGroups: string[] = [];
  let disableOwnerBypass = false;
  const sessionClaims: string[] = [];
  const taggedGroups = new Set<string>();

  if (db) {
    try {
      const profileRes = await db.select(new RecordId("user_profile", user.sub));
      const profile = Array.isArray(profileRes) ? profileRes[0] : profileRes;
      if (profile) {
        if (Array.isArray(profile.disabledGroups)) {
          disabledGroups = profile.disabledGroups;
        }
        if (typeof profile.disableOwnerBypass === "boolean") {
          disableOwnerBypass = profile.disableOwnerBypass;
        }
        if (Array.isArray(profile.sessionGrants)) {
          for (const g of profile.sessionGrants) {
            if (g && typeof g.claim === "string") {
              if (!g.sessionId || g.sessionId === (user.sessionId || "default")) {
                sessionClaims.push(g.claim);
              }
            }
          }
        }
      }
    } catch {
      // user_profile table might not exist yet
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
    jwtClaims: user.idpGroups || [],
    sessionClaims,
    taggedGroups: [...taggedGroups],
    disabledGroups,
    disableOwnerBypass,
  });
}
