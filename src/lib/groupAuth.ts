/**
 * Hierarchical Group Namespace & RBAC Engine for SolidFlow.
 *
 * Hierarchy separator: "." (e.g. "group1.test1", "org.team.sub")
 * Rights attachment: ":" (e.g. "group1.test1:(write,delete)", "group1:manager", "group1:use")
 *
 * Downward inheritance:
 *   A grant on "group1" (e.g. "group1:(view,delete)") automatically applies to
 *   resources tagged with "group1" AND any descendant namespace ("group1.test1", "group1.test1.x").
 */

export type GroupRight = "view" | "use" | "write" | "delete" | "manager";

export type GroupSource = "db" | "jwt" | "session" | "tagged";

/**
 * Platform-level interface role coming from FerrisKey (OIDC IdP).
 * - admin: Full access to everything (including Database and all spaces)
 * - creator: Workflows, Dashboards, Library, Requests, Connections, Trusted CAs, Protos (no Database)
 * - user: Alter & use Dashboards + Library
 * - viewer: Library only
 */
export type PlatformRole = "admin" | "creator" | "user" | "viewer";

export const ALL_PLATFORM_ROLES: readonly PlatformRole[] = [
  "admin",
  "creator",
  "user",
  "viewer",
] as const;

export const PLATFORM_ROLE_RANK: Record<PlatformRole, number> = {
  admin: 4,
  creator: 3,
  user: 2,
  viewer: 1,
};

export interface PlatformCapabilities {
  canAccessLibrary: boolean;
  canEditDashboards: boolean;
  canManageWorkflows: boolean;
  canUseRequests: boolean;
  canManageConnections: boolean;
  canManageCAs: boolean;
  canManageProtos: boolean;
  canManageDatabase: boolean;
  canManageGroups: boolean;
}

export const ALL_GROUP_RIGHTS: readonly GroupRight[] = [
  "view",
  "use",
  "write",
  "delete",
  "manager",
] as const;

export interface ParsedGroupGrant {
  /** Normalized group namespace path using "." separator, e.g. "group1.test1" */
  group: string;
  /** Expanded set of rights granted on this group and its descendants */
  rights: GroupRight[];
  /** Origin of the grant */
  source: GroupSource;
  /** Original raw claim string */
  raw: string;
}

export interface EffectiveGroupGrant extends ParsedGroupGrant {
  /** Whether this group is currently active (highlighted) in the user's profile */
  active: boolean;
}

export interface EffectiveAccessContext {
  /** Authenticated user subject ID (or "anonymous") */
  sub: string;
  /** Display name or username */
  username?: string;
  /** Email address */
  email?: string;
  /** Authoritative platform role from FerrisKey JWT (or admin override) */
  idpRole: PlatformRole;
  /** Effective platform role after applying optional lower-role simulation */
  platformRole: PlatformRole;
  /** Currently simulated platform role (or null when using actual idpRole) */
  simulatedRole: PlatformRole | null;
  /** Interface & API capability flags derived from the effective platformRole */
  capabilities: PlatformCapabilities;
  /** All merged group grants available to the user from SurrealDB (active and deactivated) */
  allGrants: EffectiveGroupGrant[];
  /** Currently active (highlighted) group grants */
  activeGrants: EffectiveGroupGrant[];
  /** Deactivated group names */
  disabledGroups: string[];
  /** When true, personal ownership bypass (@owner) is paused to strictly simulate group view */
  disableOwnerBypass: boolean;
  /** Whether the user has an active Admin role/grant */
  isAdmin: boolean;
  /** Whether the user has an Admin claim at all (even if currently simulating a lower role) */
  hasAdminClaim: boolean;
  /** Whether any group, @owner, or platform role is currently simulated */
  isSimulating: boolean;
}

export interface ResourcePermissions {
  canView: boolean;
  canUse: boolean;
  canWrite: boolean;
  canDelete: boolean;
  isManager: boolean;
  isOwner: boolean;
}

const ADMIN_GROUP_NAMES = new Set([
  "admin",
  "admin-group",
  "admingroup",
  "administrators",
  "realm-admin",
  "superadmin",
]);

const CREATOR_GROUP_NAMES = new Set([
  "creator",
  "creators",
  "creator-group",
  "creatorgroup",
]);

const USER_GROUP_NAMES = new Set([
  "user",
  "users",
  "user-group",
  "usergroup",
]);

const VIEWER_GROUP_NAMES = new Set([
  "viewer",
  "viewers",
  "viewer-group",
  "viewergroup",
]);

const PLATFORM_ROLE_CLAIM_NAMES = new Set([
  ...CREATOR_GROUP_NAMES,
  ...USER_GROUP_NAMES,
  ...VIEWER_GROUP_NAMES,
]);

/**
 * Normalize a raw role string into a valid PlatformRole, or return null.
 */
export function normalizePlatformRole(raw?: unknown): PlatformRole | null {
  if (!raw || typeof raw !== "string") return null;
  const clean = normalizeGroupName(raw.split(":")[0] || "");
  if (!clean) return null;
  if (isAdminGroupName(clean)) return "admin";
  if (CREATOR_GROUP_NAMES.has(clean)) return "creator";
  if (USER_GROUP_NAMES.has(clean)) return "user";
  if (VIEWER_GROUP_NAMES.has(clean)) return "viewer";
  return null;
}

/**
 * Extract the user's highest PlatformRole from FerrisKey OIDC claims.
 * Only "admin", "creator", "user", and "viewer" come from FerrisKey.
 */
export function extractPlatformRoleFromClaims(
  claims: Iterable<string> | null | undefined,
  fallback: PlatformRole = "viewer"
): PlatformRole {
  let best: PlatformRole | null = null;
  if (claims) {
    for (const raw of claims) {
      const role = normalizePlatformRole(raw);
      if (role) {
        if (!best || PLATFORM_ROLE_RANK[role] > PLATFORM_ROLE_RANK[best]) {
          best = role;
        }
      }
    }
  }
  if (best) return best;
  const envDefault = normalizePlatformRole(process.env.DEFAULT_PLATFORM_ROLE);
  return envDefault || fallback;
}

/**
 * Clamp an optional simulatedRole so a user can only simulate a role <= their idpRole.
 */
export function resolveEffectivePlatformRole(
  idpRole: PlatformRole,
  simulatedRole?: unknown
): { platformRole: PlatformRole; simulatedRole: PlatformRole | null } {
  const normSim = normalizePlatformRole(simulatedRole);
  if (
    normSim &&
    normSim !== idpRole &&
    PLATFORM_ROLE_RANK[normSim] <= PLATFORM_ROLE_RANK[idpRole]
  ) {
    return { platformRole: normSim, simulatedRole: normSim };
  }
  return { platformRole: idpRole, simulatedRole: null };
}

/**
 * Compute UI and API capabilities for a given PlatformRole.
 * - admin: Full access including Database
 * - creator: Workflows, Dashboards, Library, Requests, Connections, CAs, Protos (NOT Database)
 * - user: Alter & use Dashboards + Library
 * - viewer: Library only
 */
export function getPlatformCapabilities(role: PlatformRole): PlatformCapabilities {
  switch (role) {
    case "admin":
      return {
        canAccessLibrary: true,
        canEditDashboards: true,
        canManageWorkflows: true,
        canUseRequests: true,
        canManageConnections: true,
        canManageCAs: true,
        canManageProtos: true,
        canManageDatabase: true,
        canManageGroups: true,
      };
    case "creator":
      return {
        canAccessLibrary: true,
        canEditDashboards: true,
        canManageWorkflows: true,
        canUseRequests: true,
        canManageConnections: true,
        canManageCAs: true,
        canManageProtos: true,
        canManageDatabase: false,
        canManageGroups: true,
      };
    case "user":
      return {
        canAccessLibrary: true,
        canEditDashboards: true,
        canManageWorkflows: false,
        canUseRequests: false,
        canManageConnections: false,
        canManageCAs: false,
        canManageProtos: false,
        canManageDatabase: false,
        canManageGroups: true,
      };
    case "viewer":
    default:
      return {
        canAccessLibrary: true,
        canEditDashboards: false,
        canManageWorkflows: false,
        canUseRequests: false,
        canManageConnections: false,
        canManageCAs: false,
        canManageProtos: false,
        canManageDatabase: false,
        canManageGroups: false,
      };
  }
}

const GROUP_SEGMENT_REGEX = /^[a-z0-9_-]+$/;

/**
 * Normalize a raw group path (e.g. "/group1/test1" or "Group1.Test1") into canonical dot notation ("group1.test1").
 */
export function normalizeGroupName(rawGroup: string): string {
  return rawGroup
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, ".")
    .replace(/\.+/g, ".")
    .toLowerCase();
}

/**
 * Validate a canonical group namespace (e.g. "group1" or "group1.test1").
 * Returns null if valid, or an actionable error message if invalid.
 */
export function validateGroupName(name: string): string | null {
  const raw = (name || "").trim().replace(/^\/+|\/+$/g, "").replace(/\//g, ".");
  if (!raw) {
    return "Group name is required.";
  }
  if (raw.length > 120) {
    return "Group name must be 120 characters or fewer.";
  }
  const segments = raw.toLowerCase().split(".");
  for (const seg of segments) {
    if (!seg || !GROUP_SEGMENT_REGEX.test(seg)) {
      return `Invalid segment "${seg || ""}". Use lowercase letters, numbers, hyphens (-), or underscores (_), separated by dots (.).`;
    }
  }
  return null;
}

/**
 * Check if a normalized group name represents the global Admin-Group.
 */
export function isAdminGroupName(group: string): boolean {
  const normalized = normalizeGroupName(group);
  if (ADMIN_GROUP_NAMES.has(normalized)) return true;
  const customEnv = process.env.ADMIN_GROUP_NAMES;
  if (customEnv) {
    const customSet = new Set(
      customEnv
        .split(",")
        .map((s) => normalizeGroupName(s))
        .filter(Boolean)
    );
    if (customSet.has(normalized)) return true;
  }
  return false;
}

/**
 * Map a single right token or alias into canonical GroupRight(s), expanding implied permissions.
 */
function expandSingleRight(token: string): GroupRight[] {
  const clean = token.trim().toLowerCase();
  switch (clean) {
    case "manager":
    case "manage":
    case "admin":
    case "all":
    case "*":
      return ["view", "use", "write", "delete", "manager"];
    case "write":
    case "edit":
    case "update":
      return ["view", "use", "write"];
    case "delete":
    case "remove":
      return ["view", "delete"];
    case "use":
    case "execute":
    case "trigger":
    case "run":
      return ["view", "use"];
    case "view":
    case "read":
      return ["view"];
    default:
      return [];
  }
}

/**
 * Order rights consistently: view, use, write, delete, manager.
 */
export function sortRights(rights: Iterable<GroupRight>): GroupRight[] {
  const set = new Set(rights);
  return ALL_GROUP_RIGHTS.filter((r) => set.has(r));
}

/**
 * Parse a raw group claim string from JWT, Session, or Tag into a ParsedGroupGrant.
 *
 * Supported formats:
 *   - "group1.test1:(write,delete)"
 *   - "group1:(view,delete)"
 *   - "group1:manager"
 *   - "group1:use"
 *   - "group1.test1" (bare group -> defaults to ["view", "use"], or all rights if Admin-Group)
 *   - "/group1/test1:(write,delete)" (Keycloak slash path)
 */
export function parseGroupClaim(
  rawClaim: string,
  source: GroupSource = "jwt"
): ParsedGroupGrant | null {
  if (!rawClaim || typeof rawClaim !== "string") return null;
  const trimmed = rawClaim.trim();
  if (!trimmed) return null;

  const colonIdx = trimmed.indexOf(":");
  let rawGroupPart = trimmed;
  let rawRightsPart = "";

  if (colonIdx !== -1) {
    rawGroupPart = trimmed.slice(0, colonIdx);
    rawRightsPart = trimmed.slice(colonIdx + 1).trim();
  }

  const group = normalizeGroupName(rawGroupPart);
  if (!group) return null;

  // Admin group always implies full rights
  if (isAdminGroupName(group)) {
    return {
      group,
      rights: [...ALL_GROUP_RIGHTS],
      source,
      raw: trimmed,
    };
  }

  const rightsSet = new Set<GroupRight>();

  if (!rawRightsPart) {
    // Bare group claim without ":..." defaults to view + use
    rightsSet.add("view");
    rightsSet.add("use");
  } else {
    // Strip optional outer parentheses: "(write,delete)" -> "write,delete"
    const unwrapped = rawRightsPart.replace(/^\(|\)$/g, "").trim();
    const parts = unwrapped.split(/[,;|+\s]+/).filter(Boolean);
    for (const part of parts) {
      for (const r of expandSingleRight(part)) {
        rightsSet.add(r);
      }
    }
    // If a non-empty rights part had unrecognized tokens, still grant at least view
    if (rightsSet.size === 0) {
      rightsSet.add("view");
    }
  }

  return {
    group,
    rights: sortRights(rightsSet),
    source,
    raw: trimmed,
  };
}

/**
 * Format a group and its rights back into canonical claim syntax, e.g.:
 *   - "group1:manager"
 *   - "group1.test1:(view,write,delete)"
 */
export function formatGroupClaim(group: string, rights: GroupRight[] | string): string {
  const normGroup = normalizeGroupName(group);
  if (typeof rights === "string") {
    const clean = rights.trim();
    if (!clean) return normGroup;
    if (clean.includes(",") && !clean.startsWith("(")) {
      return `${normGroup}:(${clean})`;
    }
    return `${normGroup}:${clean}`;
  }
  const sorted = sortRights(rights);
  if (sorted.includes("manager")) {
    return `${normGroup}:manager`;
  }
  if (sorted.length === 1) {
    return `${normGroup}:${sorted[0]}`;
  }
  return `${normGroup}:(${sorted.join(",")})`;
}

/**
 * Merge multiple raw group claims (from JWT, session, and tagged resources) by normalized group name.
 * Priority of source label: "jwt" > "session" > "tagged".
 * Rights are unioned across duplicate claims for the same group.
 */
export function mergeGroupGrants(
  claimsBySource: { raw: string; source: GroupSource }[],
  disabledGroups: string[] = []
): EffectiveGroupGrant[] {
  const disabledSet = new Set(disabledGroups.map((g) => normalizeGroupName(g)));
  const map = new Map<
    string,
    { rights: Set<GroupRight>; source: GroupSource; rawList: string[] }
  >();

  const sourcePriority: Record<GroupSource, number> = {
    db: 4,
    jwt: 3,
    session: 2,
    tagged: 1,
  };

  for (const item of claimsBySource) {
    const parsed = parseGroupClaim(item.raw, item.source);
    if (!parsed) continue;
    // Do not treat bare FerrisKey platform roles (creator, user, viewer) as space grants
    if (
      item.source === "jwt" &&
      !item.raw.includes(":") &&
      PLATFORM_ROLE_CLAIM_NAMES.has(parsed.group)
    ) {
      continue;
    }
    const existing = map.get(parsed.group);
    if (!existing) {
      map.set(parsed.group, {
        rights: new Set(parsed.rights),
        source: parsed.source,
        rawList: [parsed.raw],
      });
    } else {
      for (const r of parsed.rights) existing.rights.add(r);
      if (sourcePriority[parsed.source] > sourcePriority[existing.source]) {
        existing.source = parsed.source;
      }
      if (!existing.rawList.includes(parsed.raw)) {
        existing.rawList.push(parsed.raw);
      }
    }
  }

  const result: EffectiveGroupGrant[] = [];
  for (const [group, info] of map.entries()) {
    const sortedRights = sortRights(info.rights);
    result.push({
      group,
      rights: sortedRights,
      source: info.source,
      raw: formatGroupClaim(group, sortedRights),
      active: !disabledSet.has(group),
    });
  }

  return result.sort((a, b) => {
    if (isAdminGroupName(a.group) && !isAdminGroupName(b.group)) return -1;
    if (!isAdminGroupName(a.group) && isAdminGroupName(b.group)) return 1;
    return a.group.localeCompare(b.group);
  });
}

/**
 * Determine if a user's group grant on `grantGroup` covers a resource's tag `resourceTag`.
 *
 * Hierarchy Rule:
 *   `grantGroup` covers `resourceTag` iff:
 *   - `grantGroup === resourceTag` (exact match, e.g. "group1.test1" === "group1.test1")
 *   - OR `resourceTag` is a child/descendant of `grantGroup` (e.g. "group1" covers "group1.test1" and "group1.test1.dev")
 */
export function groupCoversTag(grantGroup: string, resourceTag: string): boolean {
  const normGrant = normalizeGroupName(grantGroup);
  // If someone put a claim-like tag on a resource, strip any ":..." suffix on the tag
  const cleanTag = normalizeGroupName(resourceTag.split(":")[0] || "");
  if (!normGrant || !cleanTag) return false;
  if (isAdminGroupName(normGrant)) return true;
  if (normGrant === cleanTag) return true;
  return cleanTag.startsWith(`${normGrant}.`);
}

/**
 * Build an EffectiveAccessContext for a user.
 */
export function buildAccessContext(params: {
  sub: string;
  username?: string;
  email?: string;
  idpRole?: PlatformRole;
  simulatedRole?: PlatformRole | string | null;
  dbClaims?: string[];
  jwtClaims?: string[];
  sessionClaims?: string[];
  taggedGroups?: string[];
  disabledGroups?: string[];
  disableOwnerBypass?: boolean;
}): EffectiveAccessContext {
  const combined: { raw: string; source: GroupSource }[] = [];
  for (const c of params.dbClaims || []) {
    combined.push({ raw: c, source: "db" });
  }
  for (const c of params.jwtClaims || []) {
    combined.push({ raw: c, source: "jwt" });
  }
  for (const c of params.sessionClaims || []) {
    combined.push({ raw: c, source: "session" });
  }
  for (const g of params.taggedGroups || []) {
    const norm = normalizeGroupName(g.split(":")[0] || "");
    if (norm) {
      combined.push({ raw: `${norm}:(view,use)`, source: "tagged" });
    }
  }

  const disabledGroups = (params.disabledGroups || []).map((g) => normalizeGroupName(g)).filter(Boolean);
  const disableOwnerBypass = Boolean(params.disableOwnerBypass);
  const allGrants = mergeGroupGrants(combined, disabledGroups);
  const activeGrants = allGrants.filter((g) => g.active);

  const isAnon = !params.sub || params.sub === "anonymous";
  const resolvedIdpRole: PlatformRole = isAnon
    ? "viewer"
    : params.idpRole ||
      extractPlatformRoleFromClaims(params.jwtClaims, "user");

  const { platformRole, simulatedRole } = resolveEffectivePlatformRole(
    resolvedIdpRole,
    params.simulatedRole
  );

  const hasAdminGrant = allGrants.some((g) => isAdminGroupName(g.group));
  const hasActiveAdminGrant = activeGrants.some((g) => isAdminGroupName(g.group));
  const isAdminGrantDisabled =
    hasAdminGrant && !hasActiveAdminGrant;

  const hasAdminClaim = resolvedIdpRole === "admin" || hasAdminGrant;
  const isAdmin =
    !isAnon &&
    !isAdminGrantDisabled &&
    (platformRole === "admin" || (hasActiveAdminGrant && !simulatedRole));

  const effectiveRole: PlatformRole = isAdmin
    ? "admin"
    : platformRole === "admin" && isAdminGrantDisabled
      ? "creator"
      : platformRole;

  const capabilities = getPlatformCapabilities(effectiveRole);
  const isSimulating =
    disableOwnerBypass ||
    Boolean(simulatedRole) ||
    allGrants.some((g) => !g.active);

  return {
    sub: params.sub || "anonymous",
    username: params.username,
    email: params.email,
    idpRole: resolvedIdpRole,
    platformRole: effectiveRole,
    simulatedRole,
    capabilities,
    allGrants,
    activeGrants,
    disabledGroups,
    disableOwnerBypass,
    isAdmin,
    hasAdminClaim,
    isSimulating,
  };
}

/**
 * Compute full permissions for a resource given the user's EffectiveAccessContext.
 */
export function getResourcePermissions(
  ctx: EffectiveAccessContext,
  resource: {
    owner?: string;
    tags?: string[];
    isPublic?: boolean;
    visibility?: string;
  } | null | undefined
): ResourcePermissions {
  if (!resource) {
    return {
      canView: false,
      canUse: false,
      canWrite: false,
      canDelete: false,
      isManager: false,
      isOwner: false,
    };
  }

  const isAuthenticated = Boolean(ctx.sub && ctx.sub !== "anonymous");
  const hasRealOwner = Boolean(resource.owner && resource.owner !== "anonymous");
  const isOwner = Boolean(isAuthenticated && hasRealOwner && resource.owner === ctx.sub);

  // 1. Active Admin-Group can do everything
  if (ctx.isAdmin) {
    return {
      canView: true,
      canUse: true,
      canWrite: true,
      canDelete: true,
      isManager: true,
      isOwner,
    };
  }

  // 2. Owner bypass (when personal ownership is active and not disabled for simulation)
  if (isOwner && !ctx.disableOwnerBypass) {
    return {
      canView: true,
      canUse: true,
      canWrite: true,
      canDelete: true,
      isManager: true,
      isOwner: true,
    };
  }

  // 3. Evaluate active group grants against resource tags
  const resourceTags = (resource.tags || [])
    .map((t) => normalizeGroupName(String(t).split(":")[0] || ""))
    .filter(Boolean);

  const matchedRights = new Set<GroupRight>();
  if (resourceTags.length > 0) {
    for (const grant of ctx.activeGrants) {
      for (const tag of resourceTags) {
        if (groupCoversTag(grant.group, tag)) {
          for (const r of grant.rights) {
            matchedRights.add(r);
          }
        }
      }
    }
  }

  // 4. Legacy / Seeded unowned resources (owner is missing or "anonymous")
  // If not in simulation mode and the resource has no group tags restricting it, allow logged-in users to view/use
  if (!hasRealOwner && resourceTags.length === 0 && !ctx.isSimulating && isAuthenticated) {
    matchedRights.add("view");
    matchedRights.add("use");
    matchedRights.add("write");
  }

  // 5. Publicly published dashboards (isPublic === true) with no group tags (or in public view)
  if (resource.isPublic === true && resourceTags.length === 0 && !ctx.isSimulating) {
    matchedRights.add("view");
    matchedRights.add("use");
  }

  const isManager = matchedRights.has("manager");
  const canWrite = isManager || matchedRights.has("write");
  const canDelete = isManager || matchedRights.has("delete");
  const canUse = isManager || canWrite || matchedRights.has("use");
  const canView = isManager || canWrite || canDelete || canUse || matchedRights.has("view");

  return {
    canView,
    canUse,
    canWrite,
    canDelete,
    isManager,
    isOwner,
  };
}

/**
 * Convenience check for a single required right on a resource.
 */
export function canAccessResource(
  ctx: EffectiveAccessContext,
  resource: {
    owner?: string;
    tags?: string[];
    isPublic?: boolean;
    visibility?: string;
  } | null | undefined,
  requiredRight: GroupRight
): boolean {
  const perms = getResourcePermissions(ctx, resource);
  switch (requiredRight) {
    case "view":
      return perms.canView;
    case "use":
      return perms.canUse;
    case "write":
      return perms.canWrite;
    case "delete":
      return perms.canDelete;
    case "manager":
      return perms.isManager;
    default:
      return false;
  }
}

/**
 * Check whether the user has a specific right on a target group namespace itself
 * (e.g., checking if user has "manager" or "use" on "group1" or "group1.test1").
 */
export function hasGroupRight(
  ctx: EffectiveAccessContext,
  targetGroup: string,
  requiredRight: GroupRight
): boolean {
  if (ctx.isAdmin) return true;
  const normTarget = normalizeGroupName(targetGroup);
  if (!normTarget) return false;

  for (const grant of ctx.activeGrants) {
    if (groupCoversTag(grant.group, normTarget)) {
      if (grant.rights.includes(requiredRight) || grant.rights.includes("manager")) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Validate whether a user is allowed to create a new group namespace `groupName`.
 *
 * Rules:
 * 1. User must be authenticated.
 * 2. `groupName` must be syntactically valid (e.g. "group1" or "group1.test1").
 * 3. `groupName` must NOT already exist in `existingGroups` (and cannot be a reserved admin group unless Admin).
 * 4. If `groupName` is a root group (no "."), any authenticated user can create it if it does not exist.
 * 5. If `groupName` is a deeper group (e.g. "group1.test1"):
 *    - Its immediate parent ("group1") MUST already exist (or be covered by an active manager grant).
 *    - The user MUST have "manager" right on the parent group (via active JWT or session grant, or Admin).
 */
export function canCreateGroupNamespace(
  ctx: EffectiveAccessContext,
  rawGroupName: string,
  existingGroups: Iterable<string>
): {
  allowed: boolean;
  normalized: string;
  parent: string | null;
  leaf: string;
  error?: string;
} {
  const normalized = normalizeGroupName(rawGroupName);
  const segments = normalized ? normalized.split(".") : [];
  const leaf = segments[segments.length - 1] || "";
  const parent = segments.length > 1 ? segments.slice(0, -1).join(".") : null;

  if (!ctx.sub || ctx.sub === "anonymous") {
    return {
      allowed: false,
      normalized,
      parent,
      leaf,
      error: "You must be logged in to create a group.",
    };
  }

  if (ctx.capabilities && !ctx.capabilities.canManageGroups && !ctx.isAdmin) {
    return {
      allowed: false,
      normalized,
      parent,
      leaf,
      error: "Your platform role (viewer) does not permit creating spaces/groups.",
    };
  }

  const formatError = validateGroupName(rawGroupName);
  if (formatError) {
    return {
      allowed: false,
      normalized,
      parent,
      leaf,
      error: formatError,
    };
  }

  if ((isAdminGroupName(normalized) || PLATFORM_ROLE_CLAIM_NAMES.has(normalized)) && !ctx.isAdmin) {
    return {
      allowed: false,
      normalized,
      parent,
      leaf,
      error: `"${normalized}" is a reserved platform role name.`,
    };
  }

  const existingSet = new Set<string>();
  for (const g of existingGroups) {
    const norm = normalizeGroupName(g);
    if (norm) existingSet.add(norm);
  }
  // Also consider any group currently in the user's SurrealDB/JWT/session grants as existing
  for (const g of ctx.allGrants) {
    if (g.source === "db" || g.source === "jwt" || g.source === "session") {
      existingSet.add(g.group);
    }
  }

  if (existingSet.has(normalized)) {
    return {
      allowed: false,
      normalized,
      parent,
      leaf,
      error: `Group "${normalized}" already exists.`,
    };
  }

  // Root group creation
  if (!parent) {
    return {
      allowed: true,
      normalized,
      parent: null,
      leaf,
    };
  }

  // Deeper sub-group creation: parent must exist and user must have manager right on parent
  const parentExists = existingSet.has(parent) || hasGroupRight(ctx, parent, "manager");
  if (!parentExists) {
    return {
      allowed: false,
      normalized,
      parent,
      leaf,
      error: `Parent group "${parent}" does not exist. Create "${parent}" first before creating "${normalized}".`,
    };
  }

  if (!hasGroupRight(ctx, parent, "manager")) {
    return {
      allowed: false,
      normalized,
      parent,
      leaf,
      error: `You need "${parent}:manager" permission to create sub-group "${normalized}".`,
    };
  }

  return {
    allowed: true,
    normalized,
    parent,
    leaf,
  };
}

/**
 * Extract group/role claim strings from an OIDC profile or decoded JWT payload (Keycloak & FerrisKey compatible).
 */
export function extractClaimsFromOidcPayload(
  payload: Record<string, any> | null | undefined,
  clientId?: string
): string[] {
  if (!payload || typeof payload !== "object") return [];
  const rawClaims: string[] = [];

  const pushItems = (val: unknown) => {
    if (!val) return;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string" && item.trim()) {
          rawClaims.push(item.trim());
        }
      }
    } else if (typeof val === "string" && val.trim()) {
      rawClaims.push(val.trim());
    }
  };

  // Custom configured claim name if set
  const customClaim = process.env.OIDC_GROUPS_CLAIM;
  if (customClaim && payload[customClaim]) {
    pushItems(payload[customClaim]);
  }

  // Standard OIDC / Keycloak / FerrisKey claims
  pushItems(payload.groups);
  pushItems(payload.roles);
  pushItems(payload.entitlements);
  pushItems(payload.group_permissions);

  // Keycloak realm_access.roles
  if (payload.realm_access && typeof payload.realm_access === "object") {
    pushItems(payload.realm_access.roles);
  }

  // Keycloak resource_access[clientId].roles
  if (payload.resource_access && typeof payload.resource_access === "object") {
    if (clientId && payload.resource_access[clientId]) {
      pushItems(payload.resource_access[clientId].roles);
    }
    for (const [key, val] of Object.entries(payload.resource_access)) {
      if (key !== "account" && val && typeof val === "object") {
        pushItems((val as any).roles);
      }
    }
  }

  // Filter out default noisy Keycloak internal roles
  const IGNORED_OIDC_ROLES = new Set([
    "offline_access",
    "uma_authorization",
    "default-roles-master",
  ]);

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const c of rawClaims) {
    const base = c.split(":")[0]?.trim().toLowerCase() || "";
    if (IGNORED_OIDC_ROLES.has(base) || base.startsWith("default-roles-")) {
      continue;
    }
    if (!seen.has(c)) {
      seen.add(c);
      cleaned.push(c);
    }
  }

  return cleaned;
}

/**
 * Safely decode the JSON header of a JWT string (e.g. { alg: "RS256", typ: "JWT", kid: "..." }).
 */
export function decodeJwtHeaderSafe(jwtString?: string): Record<string, any> | null {
  if (!jwtString || typeof jwtString !== "string") return null;
  const parts = jwtString.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Format a standard numeric Unix epoch timestamp (seconds) into a readable date string.
 */
export function formatJwtTimestamp(epochSeconds?: unknown): string {
  if (epochSeconds === null || epochSeconds === undefined) return "";
  const num = typeof epochSeconds === "number" ? epochSeconds : Number(epochSeconds);
  if (!Number.isFinite(num) || num <= 0) {
    return "";
  }
  try {
    const d = new Date(num * 1000);
    return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  } catch {
    return "";
  }
}

/**
 * Safely decode the JSON payload of a JWT string (without signature verification, used for reading
 * claims from the already-verified OIDC token response in the NextAuth/SolidAuth jwt callback).
 */
export function decodeJwtPayloadSafe(jwtString?: string): Record<string, any> | null {
  if (!jwtString || typeof jwtString !== "string") return null;
  const parts = jwtString.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
