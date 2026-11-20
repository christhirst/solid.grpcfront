import { getSession } from "@auth/solid-start";
import { RecordId } from "surrealdb";
import { authOpts } from "~/routes/api/auth/[...solidauth]";
import { createDynamicRequest } from "~/lib/authUrl";
import {
  buildAccessContext,
  createDefaultWorkflowUserContext,
  extractPlatformRoleFromClaims,
  formatGroupClaim,
  normalizeGroupName,
  normalizePlatformRole,
  type EffectiveAccessContext,
  type PlatformRole,
  type WorkflowUserContext,
} from "~/lib/groupAuth";
export { createDefaultWorkflowUserContext, type WorkflowUserContext };

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

const authUserMemo = new WeakMap<Request, Promise<AuthUser | null>>();

/**
 * Extract the authenticated user from a request, or return null if not logged in.
 * Memoized per Request object so the session JWE is decoded at most once per request,
 * even when several helpers (access context, user context, owner) are called.
 */
export function getAuthUser(request: Request): Promise<AuthUser | null> {
  if (!request || typeof request !== "object") return resolveAuthUser(request);
  const cached = authUserMemo.get(request);
  if (cached) return cached;
  const promise = resolveAuthUser(request);
  authUserMemo.set(request, promise);
  return promise;
}

async function resolveAuthUser(request: Request): Promise<AuthUser | null> {
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

const ACCESS_CTX_TTL_MS = 15_000;
const ACCESS_CTX_SWEEP_THRESHOLD = 256;
const ACCESS_CTX_MAX_ENTRIES = 5000;

interface ResolvedAccess {
  ctx: EffectiveAccessContext;
  /** Raw `user_profile` record (as read during resolution), or null. */
  profile: any | null;
}

const accessContextCache = new Map<
  string,
  { expiresAt: number; promise: Promise<ResolvedAccess> }
>();

/**
 * Drop cached access contexts. Call after any mutation of group membership,
 * group namespaces, user_profile (roles, grants, simulation, namespace).
 * Without `sub` the whole cache is cleared (e.g. group-wide changes).
 */
export function invalidateAccessContextCache(sub?: string) {
  if (!sub) {
    accessContextCache.clear();
    return;
  }
  for (const key of accessContextCache.keys()) {
    if (key.startsWith(`${sub}:`)) {
      accessContextCache.delete(key);
    }
  }
}

function sweepAccessContextCache(now: number) {
  if (accessContextCache.size < ACCESS_CTX_SWEEP_THRESHOLD) return;
  for (const [key, entry] of accessContextCache) {
    if (entry.expiresAt <= now) accessContextCache.delete(key);
  }
  // Hard cap: evict oldest insertions (Map preserves insertion order).
  if (accessContextCache.size > ACCESS_CTX_MAX_ENTRIES) {
    let excess = accessContextCache.size - ACCESS_CTX_MAX_ENTRIES;
    for (const key of accessContextCache.keys()) {
      if (excess-- <= 0) break;
      accessContextCache.delete(key);
    }
  }
}

const ANONYMOUS_ACCESS: () => ResolvedAccess = () => ({
  ctx: buildAccessContext({ sub: "anonymous", idpRole: "viewer" }),
  profile: null,
});

async function getResolvedAccess(request: Request, db?: any): Promise<ResolvedAccess> {
  const user = await getAuthUser(request);
  if (!user || !user.sub || user.sub === "anonymous") {
    return ANONYMOUS_ACCESS();
  }

  const cacheKey = `${user.sub}:${user.sessionId || "default"}:${Boolean(db)}`;
  const now = Date.now();
  const cached = accessContextCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = resolveEffectiveAccessContextInternal(user, db).catch((err) => {
    accessContextCache.delete(cacheKey);
    throw err;
  });

  sweepAccessContextCache(now);
  accessContextCache.set(cacheKey, {
    expiresAt: now + ACCESS_CTX_TTL_MS,
    promise,
  });

  return promise;
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
  return (await getResolvedAccess(request, db)).ctx;
}

async function resolveEffectiveAccessContextInternal(
  user: AuthUser,
  db?: any
): Promise<ResolvedAccess> {
  let profileRecord: any | null = null;
  let idpRole: PlatformRole = extractPlatformRoleFromClaims(user.idpGroups, "viewer");
  let simulatedRole: PlatformRole | null = null;
  let disabledGroups: string[] = [];
  let disableOwnerBypass = false;
  const dbClaims: string[] = [];
  const sessionClaims: string[] = [];

  if (db) {
    const profileId = new RecordId("user_profile", user.sub);
    const usernameLower = (user.username || user.name || "").trim().toLowerCase();
    const emailLower = (user.email || "").trim().toLowerCase();
    const subLower = user.sub.trim().toLowerCase();
    // Empty names are dropped so rows without a username never match.
    const names = Array.from(new Set([usernameLower, emailLower, subLower].filter(Boolean)));

    // Run all 3 SurrealDB lookups concurrently instead of sequentially
    const [profileRes, memberRes, ownedRes] = await Promise.all([
      db.select(profileId).catch(() => null),
      db
        .query(
          // `username_lc` is an indexed computed field; also match `username IN $names`
          // so reads prior to background backfill still use indexes without a table scan.
          `SELECT * FROM group_member WHERE userSub = $sub OR username_lc IN $names OR username IN $names;`,
          {
            sub: user.sub,
            names,
          }
        )
        .catch(() => null),
      db
        .query(`SELECT name FROM group_namespace WHERE owner = $owner;`, {
          owner: user.sub,
        })
        .catch(() => null),
    ]);

    try {
      const profile = Array.isArray(profileRes) ? profileRes[0] : profileRes;
      profileRecord = profile || null;
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

      // Keep user_profile synced non-blockingly in the background
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
        db.query(`UPSERT $profile MERGE $mergeData;`, {
          profile: profileId,
          mergeData,
        }).catch(() => {});
      }
    } catch {}

    try {
      const memberRows = Array.isArray(memberRes)
        ? Array.isArray(memberRes[0])
          ? memberRes[0]
          : memberRes
        : [];
      for (const m of memberRows) {
        if (m && m.group) {
          const isMgr =
            m.role === "manager" ||
            (Array.isArray(m.rights) && m.rights.includes("manager")) ||
            (typeof m.rights === "string" && m.rights.includes("manager"));
          const rights = isMgr
            ? "manager"
            : ["view", "use", "write", "delete"];
          dbClaims.push(formatGroupClaim(String(m.group), rights as any));
        }
      }
    } catch {}

    try {
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
    } catch {}
  }

  const ctx = buildAccessContext({
    sub: user.sub,
    username: user.username || user.name || user.sub,
    email: user.email,
    idpRole,
    simulatedRole,
    dbClaims,
    sessionClaims,
    disabledGroups,
    disableOwnerBypass,
  });
  return { ctx, profile: profileRecord };
}

/**
 * Build the complete `$user` runtime context (`{{ $user.* }}`) for workflow & dashboard executions.
 * Includes both `oidc.claims` (JWT claims from OIDC login) and `userdata` (SolidFlow user profile, groups, grants, roles).
 */
export async function buildWorkflowUserContext(
  request: Request,
  db?: any
): Promise<WorkflowUserContext> {
  try {
    const [user, resolved] = await Promise.all([
      getAuthUser(request),
      getResolvedAccess(request, db),
    ]);
    const ctx = resolved.ctx;

    const sub = user?.sub || ctx.sub || "anonymous";
    if (!sub || sub === "anonymous") {
      return createDefaultWorkflowUserContext();
    }

    // Reuse the user_profile record already read by the access-context resolver.
    const profileRecord: any = db ? resolved.profile : null;

    const username = user?.username || profileRecord?.username || ctx.username || user?.name || sub;
    const name = user?.name || profileRecord?.name || username;
    const email = user?.email || profileRecord?.email || ctx.email || "";
    const image = user?.image || profileRecord?.image || undefined;
    const namespace = typeof profileRecord?.namespace === "string" ? profileRecord.namespace : "";

    const rawClaims: Record<string, any> = {
      ...(profileRecord?.lastJwtClaims && typeof profileRecord.lastJwtClaims === "object"
        ? profileRecord.lastJwtClaims
        : {}),
      ...(user?.jwtClaims && typeof user.jwtClaims === "object" ? user.jwtClaims : {}),
    };
    if (!rawClaims.sub) rawClaims.sub = sub;
    if (!rawClaims.preferred_username && username) rawClaims.preferred_username = username;
    if (!rawClaims.name && name) rawClaims.name = name;
    if (!rawClaims.email && email) rawClaims.email = email;

    const rawHeader: Record<string, any> = {
      ...(profileRecord?.lastJwtHeader && typeof profileRecord.lastJwtHeader === "object"
        ? profileRecord.lastJwtHeader
        : {}),
      ...(user?.jwtHeader && typeof user.jwtHeader === "object" ? user.jwtHeader : {}),
    };

    const activeGroups = ctx.activeGrants.map((g) => g.group);
    const allGroups = ctx.allGrants.map((g) => g.group);
    const activeGrantsRaw = ctx.activeGrants.map((g) => g.raw);
    const allGrantsRaw = ctx.allGrants.map((g) => g.raw);
    const namespaces = Array.from(new Set([namespace, ...activeGroups].filter(Boolean)));
    const oidcGroups = Array.isArray(user?.idpGroups)
      ? user.idpGroups
      : Array.isArray(rawClaims.groups)
        ? rawClaims.groups.map(String)
        : [];

    return {
      sub,
      id: sub,
      username,
      name,
      email,
      image,
      authenticated: true,
      role: ctx.platformRole,
      idpRole: ctx.idpRole,
      platformRole: ctx.platformRole,
      groups: activeGroups,
      activeGrants: activeGrantsRaw,
      namespace,
      oidc: {
        claims: rawClaims,
        header: rawHeader,
        groups: oidcGroups,
      },
      userdata: {
        sub,
        username,
        name,
        email,
        image,
        namespace,
        namespaces,
        idpRole: ctx.idpRole,
        platformRole: ctx.platformRole,
        simulatedRole: ctx.simulatedRole,
        isAdmin: ctx.isAdmin,
        hasAdminClaim: ctx.hasAdminClaim,
        isSimulating: ctx.isSimulating,
        groups: activeGroups,
        allGroups,
        activeGrants: activeGrantsRaw,
        allGrants: allGrantsRaw,
        grants: ctx.activeGrants,
        disabledGroups: ctx.disabledGroups,
        disableOwnerBypass: ctx.disableOwnerBypass,
        capabilities: ctx.capabilities,
      },
    };
  } catch {
    return createDefaultWorkflowUserContext();
  }
}
