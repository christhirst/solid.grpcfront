import { describe, expect, test } from "bun:test";
import {
  normalizeGroupName,
  validateGroupName,
  parseGroupClaim,
  formatGroupClaim,
  groupCoversTag,
  buildAccessContext,
  getResourcePermissions,
  canAccessResource,
  canCreateGroupNamespace,
  extractClaimsFromOidcPayload,
  extractPlatformRoleFromClaims,
  getPlatformCapabilities,
  resolveEffectivePlatformRole,
  decodeJwtHeaderSafe,
  formatJwtTimestamp,
  getObjectPermissions,
  canAccessObject,
  mergeTagUpdate,
  getTaggableGroups,
  canPublishToNamespace,
  canManageNamespace,
} from "./groupAuth";

describe("groupAuth - claim parsing and normalization", () => {
  test("normalizes slash paths and casing to dot-separated lowercase", () => {
    expect(normalizeGroupName("/group1/test1/")).toBe("group1.test1");
    expect(normalizeGroupName("Group1.Test1")).toBe("group1.test1");
    expect(normalizeGroupName("org//team..dev")).toBe("org.team.dev");
  });

  test("validates group namespace format", () => {
    expect(validateGroupName("group1")).toBeNull();
    expect(validateGroupName("group1.test1")).toBeNull();
    expect(validateGroupName("my-team_1.sub-team_2")).toBeNull();
    expect(validateGroupName("")).toContain("required");
    expect(validateGroupName("group1..bad")).toContain("Invalid segment");
    expect(validateGroupName("group1.bad$char")).toContain("Invalid segment");
  });

  test("parses tuple syntax like group1.test1:(write,delete)", () => {
    const parsed = parseGroupClaim("group1.test1:(write,delete)");
    expect(parsed).not.toBeNull();
    expect(parsed!.group).toBe("group1.test1");
    expect(parsed!.rights).toEqual(["view", "use", "write", "delete"]);
  });

  test("parses group1:(view,delete)", () => {
    const parsed = parseGroupClaim("group1:(view,delete)");
    expect(parsed).not.toBeNull();
    expect(parsed!.group).toBe("group1");
    expect(parsed!.rights).toEqual(["view", "delete"]);
  });

  test("parses single role syntax like group1:manager and group1:use", () => {
    const mgr = parseGroupClaim("group1:manager");
    expect(mgr!.group).toBe("group1");
    expect(mgr!.rights).toEqual(["view", "use", "write", "delete", "manager"]);

    const useOnly = parseGroupClaim("group1:use");
    expect(useOnly!.group).toBe("group1");
    expect(useOnly!.rights).toEqual(["view", "use"]);
  });

  test("parses bare group claims and Admin-Group", () => {
    const bare = parseGroupClaim("/group1/test1");
    expect(bare!.group).toBe("group1.test1");
    expect(bare!.rights).toEqual(["view", "use"]);

    const admin = parseGroupClaim("Admin-Group");
    expect(admin!.group).toBe("admin-group");
    expect(admin!.rights).toEqual(["view", "use", "write", "delete", "manager"]);
  });

  test("formats group claims back into canonical strings", () => {
    expect(formatGroupClaim("group1", ["view", "use", "write", "delete", "manager"])).toBe("group1:manager");
    expect(formatGroupClaim("group1.test1", ["view", "delete"])).toBe("group1.test1:(view,delete)");
    expect(formatGroupClaim("group1", ["use"])).toBe("group1:use");
  });
});

describe("groupAuth - hierarchical inheritance and resource permissions", () => {
  test("parent group covers child tags but not sibling or parent tags", () => {
    expect(groupCoversTag("group1", "group1")).toBe(true);
    expect(groupCoversTag("group1", "group1.test1")).toBe(true);
    expect(groupCoversTag("group1", "group1.test1.deep")).toBe(true);
    expect(groupCoversTag("group1", "group10")).toBe(false);
    expect(groupCoversTag("group1.test1", "group1")).toBe(false);
  });

  test("user with group1:(view,delete) can view and delete 'New Bool' dashboard tagged with group1.test1, but cannot write", () => {
    const ctx = buildAccessContext({
      sub: "user-2",
      jwtClaims: ["group1:(view,delete)"],
    });

    const newBoolDashboard = {
      owner: "user-1",
      name: "New Bool",
      tags: ["group1.test1"],
      isPublic: false,
    };

    const perms = getResourcePermissions(ctx, newBoolDashboard);
    expect(perms.canView).toBe(true);
    expect(perms.canDelete).toBe(true);
    expect(perms.canWrite).toBe(false);
    expect(perms.canUse).toBe(false);
  });

  test("resources are private to creator by default when untagged", () => {
    const creatorCtx = buildAccessContext({ sub: "creator-1", jwtClaims: [] });
    const otherCtx = buildAccessContext({ sub: "other-user", jwtClaims: ["group1:manager"] });

    const resource = {
      owner: "creator-1",
      tags: [],
    };

    expect(canAccessResource(creatorCtx, resource, "view")).toBe(true);
    expect(canAccessResource(creatorCtx, resource, "write")).toBe(true);
    expect(canAccessResource(creatorCtx, resource, "delete")).toBe(true);

    expect(canAccessResource(otherCtx, resource, "view")).toBe(false);
    expect(canAccessResource(otherCtx, resource, "write")).toBe(false);
    expect(canAccessResource(otherCtx, resource, "delete")).toBe(false);
  });

  test("group deactivation and @owner bypass simulation shows strictly what active groups can see", () => {
    // Creator tags a dashboard with 'group2' and wants to test what a member of only 'group2' sees
    const ctxSimulated = buildAccessContext({
      sub: "creator-1",
      jwtClaims: ["group1:manager"],
      taggedGroups: ["group2"],
      disabledGroups: ["group1"],
      disableOwnerBypass: true,
    });

    const dashGroup1 = { owner: "creator-1", tags: ["group1"] };
    const dashGroup2 = { owner: "creator-1", tags: ["group2"] };
    const dashPrivate = { owner: "creator-1", tags: [] };

    // Because group1 and @owner are deactivated, only dashGroup2 is visible!
    expect(canAccessResource(ctxSimulated, dashGroup1, "view")).toBe(false);
    expect(canAccessResource(ctxSimulated, dashPrivate, "view")).toBe(false);
    expect(canAccessResource(ctxSimulated, dashGroup2, "view")).toBe(true);
    expect(canAccessResource(ctxSimulated, dashGroup2, "use")).toBe(true);
    // A bare tagged viewer of group2 cannot delete or edit
    expect(canAccessResource(ctxSimulated, dashGroup2, "delete")).toBe(false);
  });

  test("Admin-Group can see and manage everything when active, and restricts when deactivated", () => {
    const activeAdmin = buildAccessContext({
      sub: "admin-user",
      jwtClaims: ["Admin-Group", "group1:(view)"],
    });

    const foreignPrivate = { owner: "someone-else", tags: [] };
    expect(canAccessResource(activeAdmin, foreignPrivate, "view")).toBe(true);
    expect(canAccessResource(activeAdmin, foreignPrivate, "delete")).toBe(true);

    const deactivatedAdmin = buildAccessContext({
      sub: "admin-user",
      jwtClaims: ["Admin-Group", "group1:(view)"],
      disabledGroups: ["admin-group"],
      disableOwnerBypass: true,
    });

    expect(deactivatedAdmin.isAdmin).toBe(false);
    expect(deactivatedAdmin.hasAdminClaim).toBe(true);
    expect(canAccessResource(deactivatedAdmin, foreignPrivate, "view")).toBe(false);
    expect(canAccessResource(deactivatedAdmin, { owner: "someone-else", tags: ["group1.sub"] }, "view")).toBe(true);
  });
});

describe("groupAuth - group creation rules", () => {
  test("allows creating a root group only if it does not exist", () => {
    const ctx = buildAccessContext({ sub: "user-1", jwtClaims: [] });
    const existing = new Set(["existing-root"]);

    const ok = canCreateGroupNamespace(ctx, "group1", existing);
    expect(ok.allowed).toBe(true);
    expect(ok.normalized).toBe("group1");
    expect(ok.parent).toBeNull();

    const dup = canCreateGroupNamespace(ctx, "existing-root", existing);
    expect(dup.allowed).toBe(false);
    expect(dup.error).toContain("already exists");
  });

  test("rejects creating a deeper group if parent does not exist or user lacks parent:manager", () => {
    const ctxNoRights = buildAccessContext({ sub: "user-1", jwtClaims: ["group1:use"] });
    const existing = new Set(["group1"]);

    // Parent does not exist
    const noParent = canCreateGroupNamespace(ctxNoRights, "nonexistent.test1", existing);
    expect(noParent.allowed).toBe(false);
    expect(noParent.error).toContain("does not exist");

    // Parent exists, but user only has group1:use (not manager)
    const notMgr = canCreateGroupNamespace(ctxNoRights, "group1.test1", existing);
    expect(notMgr.allowed).toBe(false);
    expect(notMgr.error).toContain("group1:manager");

    // User has session or JWT group1:manager -> allowed!
    const ctxMgr = buildAccessContext({
      sub: "user-1",
      sessionClaims: ["group1:manager"],
    });
    const allowedSub = canCreateGroupNamespace(ctxMgr, "group1.test1", existing);
    expect(allowedSub.allowed).toBe(true);
    expect(allowedSub.parent).toBe("group1");
    expect(allowedSub.leaf).toBe("test1");
  });
});

describe("groupAuth - OIDC claim extraction", () => {
  test("extracts groups and roles from Keycloak and FerrisKey payloads", () => {
    const claims = extractClaimsFromOidcPayload(
      {
        groups: ["/group1/test1:(write,delete)", "group2:manager"],
        realm_access: { roles: ["offline_access", "Admin-Group"] },
        resource_access: {
          "solid-grpcfront": { roles: ["group3:use"] },
        },
      },
      "solid-grpcfront"
    );

    expect(claims).toEqual([
      "/group1/test1:(write,delete)",
      "group2:manager",
      "Admin-Group",
      "group3:use",
    ]);
  });

  test("extracts FerrisKey platform roles (admin, creator, user, viewer) with correct rank priority", () => {
    expect(extractPlatformRoleFromClaims(["viewer", "creator"])).toBe("creator");
    expect(extractPlatformRoleFromClaims(["/user", "admin"])).toBe("admin");
    expect(extractPlatformRoleFromClaims(["user"])).toBe("user");
    expect(extractPlatformRoleFromClaims(["viewer"])).toBe("viewer");
    expect(extractPlatformRoleFromClaims([], "viewer")).toBe("viewer");
  });

  test("computes interface capabilities for admin, creator, user, and viewer", () => {
    const adminCaps = getPlatformCapabilities("admin");
    expect(adminCaps.canManageDatabase).toBe(true);
    expect(adminCaps.canManageWorkflows).toBe(true);
    expect(adminCaps.canEditDashboards).toBe(true);

    const creatorCaps = getPlatformCapabilities("creator");
    expect(creatorCaps.canManageDatabase).toBe(false);
    expect(creatorCaps.canManageWorkflows).toBe(true);
    expect(creatorCaps.canUseRequests).toBe(true);
    expect(creatorCaps.canManageConnections).toBe(true);
    expect(creatorCaps.canManageCAs).toBe(true);
    expect(creatorCaps.canManageProtos).toBe(true);
    expect(creatorCaps.canEditDashboards).toBe(true);

    const userCaps = getPlatformCapabilities("user");
    expect(userCaps.canManageDatabase).toBe(false);
    expect(userCaps.canManageWorkflows).toBe(false);
    expect(userCaps.canUseRequests).toBe(false);
    expect(userCaps.canManageConnections).toBe(false);
    expect(userCaps.canEditDashboards).toBe(true);
    expect(userCaps.canAccessLibrary).toBe(true);

    const viewerCaps = getPlatformCapabilities("viewer");
    expect(viewerCaps.canEditDashboards).toBe(false);
    expect(viewerCaps.canManageGroups).toBe(false);
    expect(viewerCaps.canAccessLibrary).toBe(true);
  });

  test("clamps simulatedRole so users cannot escalate above their FerrisKey idpRole", () => {
    // Creator simulating user -> allowed
    expect(resolveEffectivePlatformRole("creator", "user")).toEqual({
      platformRole: "user",
      simulatedRole: "user",
    });
    // Creator trying to simulate admin -> ignored, stays creator
    expect(resolveEffectivePlatformRole("creator", "admin")).toEqual({
      platformRole: "creator",
      simulatedRole: null,
    });
  });

  test("resolves SurrealDB dbClaims alongside FerrisKey platform role", () => {
    const ctx = buildAccessContext({
      sub: "u-creator",
      idpRole: "creator",
      dbClaims: ["ops.monitoring:(view,use,write)", "team1:manager"],
    });

    expect(ctx.platformRole).toBe("creator");
    expect(ctx.capabilities.canManageWorkflows).toBe(true);
    expect(ctx.capabilities.canManageDatabase).toBe(false);
    expect(ctx.activeGrants.map((g) => g.group)).toEqual(["ops.monitoring", "team1"]);
    expect(
      canAccessResource(ctx, { owner: "other", tags: ["team1.sub"] }, "delete")
    ).toBe(true);
  });

  test("decodeJwtHeaderSafe decodes valid JWT headers and handles invalid inputs", () => {
    // Header: { "alg": "RS256", "typ": "JWT", "kid": "ferris-key-1" }
    const headerB64 = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "ferris-key-1" })).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify({ sub: "user-1" })).toString("base64url");
    const token = `${headerB64}.${payloadB64}.fake-sig`;

    const decoded = decodeJwtHeaderSafe(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.alg).toBe("RS256");
    expect(decoded!.typ).toBe("JWT");
    expect(decoded!.kid).toBe("ferris-key-1");

    // Invalid inputs
    expect(decodeJwtHeaderSafe("")).toBeNull();
    expect(decodeJwtHeaderSafe(null as any)).toBeNull();
    expect(decodeJwtHeaderSafe("not-a-jwt")).toBeNull();
    expect(decodeJwtHeaderSafe("bad_header.bad_payload.sig")).toBeNull();
  });

  test("formatJwtTimestamp formats epoch seconds properly", () => {
    // 1700000000 = 2023-11-14T22:13:20.000Z
    const formatted = formatJwtTimestamp(1700000000);
    expect(formatted).toContain("2023");
    expect(formatJwtTimestamp(null)).toBe("");
    expect(formatJwtTimestamp(undefined)).toBe("");
    expect(formatJwtTimestamp("not-a-number")).toBe("");
  });
});

describe("groupAuth - two-stage object visibility & group-owned namespaces", () => {
  const creatorInGroup1 = buildAccessContext({
    sub: "creator-1",
    idpRole: "creator",
    dbClaims: ["group1:(view,use,write,delete)"],
  });
  const managerInGroup1 = buildAccessContext({
    sub: "mgr-1",
    idpRole: "creator",
    dbClaims: ["group1:manager"],
  });
  const creatorOutside = buildAccessContext({
    sub: "creator-2",
    idpRole: "creator",
    dbClaims: ["other-group:(view,use,write,delete)"],
  });
  const userInGroup1 = buildAccessContext({
    sub: "user-1",
    idpRole: "user",
    dbClaims: ["group1:(view,use,write,delete)"],
  });
  const viewerInGroup1 = buildAccessContext({
    sub: "viewer-1",
    idpRole: "viewer",
    dbClaims: ["group1:(view,use,write,delete)"],
  });

  test("Stage 1: user and viewer can never see workflows even if owner, in group1, or tagged public", () => {
    const wfGroup1 = { owner: "user-1", tags: ["group1", "public"] };
    expect(getObjectPermissions(userInGroup1, wfGroup1, "workflow").canView).toBe(false);
    expect(getObjectPermissions(viewerInGroup1, wfGroup1, "workflow").canView).toBe(false);
    expect(canAccessObject(userInGroup1, wfGroup1, "workflow", "view")).toBe(false);
    expect(canAccessObject(viewerInGroup1, wfGroup1, "workflow", "view")).toBe(false);
  });

  test("Stage 2: creator in group1 can see and edit group1 and hierarchical child workflows, plus own workflows", () => {
    const wfGroup1 = { owner: "someone-else", tags: ["group1"] };
    const wfChild = { owner: "someone-else", tags: ["group1.sub"] };
    const wfOwnPrivate = { owner: "creator-1", tags: [] };
    const wfForeign = { owner: "someone-else", tags: ["secret-group"] };

    const p1 = getObjectPermissions(creatorInGroup1, wfGroup1, "workflow");
    expect(p1.canView).toBe(true);
    expect(p1.canWrite).toBe(true);
    expect(p1.canDelete).toBe(false); // plain member cannot delete another user's workflow

    // Group manager can also delete
    const pMgr = getObjectPermissions(managerInGroup1, wfChild, "workflow");
    expect(pMgr.canView).toBe(true);
    expect(pMgr.canWrite).toBe(true);
    expect(pMgr.canDelete).toBe(true);

    // Own private workflow
    const pOwn = getObjectPermissions(creatorInGroup1, wfOwnPrivate, "workflow");
    expect(pOwn.canView).toBe(true);
    expect(pOwn.canWrite).toBe(true);
    expect(pOwn.canDelete).toBe(true);

    // Foreign workflow is hidden
    expect(getObjectPermissions(creatorInGroup1, wfForeign, "workflow").canView).toBe(false);
  });

  test("'public' tag grants view+use to everyone whose role can see the category, but not write", () => {
    const publicWf = { owner: "creator-1", tags: ["public"] };
    const publicDash = { owner: "creator-1", tags: ["public"] };

    // Outside creator can view & use public workflow, but cannot edit
    const wfPerms = getObjectPermissions(creatorOutside, publicWf, "workflow");
    expect(wfPerms.canView).toBe(true);
    expect(wfPerms.canUse).toBe(true);
    expect(wfPerms.canWrite).toBe(false);

    // User and viewer can view & use public dashboard, but cannot edit (unless in another group on it)
    const userDashPerms = getObjectPermissions(userInGroup1, publicDash, "dashboard");
    expect(userDashPerms.canView).toBe(true);
    expect(userDashPerms.canWrite).toBe(false);

    const viewerDashPerms = getObjectPermissions(viewerInGroup1, publicDash, "dashboard");
    expect(viewerDashPerms.canView).toBe(true);
    expect(viewerDashPerms.canWrite).toBe(false);

    // If dashboard is tagged ["public", "group1"], userInGroup1 CAN edit it, viewerInGroup1 can only view
    const groupAndPublicDash = { owner: "creator-1", tags: ["public", "group1"] };
    expect(getObjectPermissions(userInGroup1, groupAndPublicDash, "dashboard").canWrite).toBe(true);
    expect(getObjectPermissions(viewerInGroup1, groupAndPublicDash, "dashboard").canWrite).toBe(false);
  });

  test("mergeTagUpdate preserves foreign tags and updates allowed tags", () => {
    const existing = ["finance", "group1"];
    const allowed = ["public", "group1", "group1.sub"];

    // User unchecks group1 and checks public + group1.sub; 'finance' must stay intact
    const merged = mergeTagUpdate(existing, ["public", "group1.sub", "hacked-group"], allowed);
    expect(merged).toEqual(["finance", "public", "group1.sub"]);
  });

  test("getTaggableGroups returns 'public' first followed by user's active groups", () => {
    expect(getTaggableGroups(creatorInGroup1, ["group1", "secret"])).toEqual(["public", "group1"]);
    const adminCtx = buildAccessContext({ sub: "admin-1", idpRole: "admin" });
    expect(getTaggableGroups(adminCtx, ["zeta", "alpha"])).toEqual(["public", "alpha", "zeta"]);
  });

  test("canCreateGroupNamespace rejects reserved 'public' tag", () => {
    const res = canCreateGroupNamespace(creatorInGroup1, "public", []);
    expect(res.allowed).toBe(false);
    expect(res.error).toContain("reserved");
  });

  test("canPublishToNamespace and canManageNamespace enforce personal and group ownership", () => {
    const personalNs = { name: "alice-ns", ownerType: "user" as const, ownerSub: "creator-1" };
    const groupNs = { name: "team-ops", ownerType: "group" as const, ownerGroup: "group1" };

    // Personal namespace: only owner (or admin) can publish & manage
    expect(canPublishToNamespace(creatorInGroup1, personalNs)).toBe(true);
    expect(canManageNamespace(creatorInGroup1, personalNs)).toBe(true);
    expect(canPublishToNamespace(creatorOutside, personalNs)).toBe(false);

    // Group namespace: any member with dashboard edit capability (creator, user) can publish; viewer cannot
    expect(canPublishToNamespace(creatorInGroup1, groupNs)).toBe(true);
    expect(canPublishToNamespace(userInGroup1, groupNs)).toBe(true);
    expect(canPublishToNamespace(viewerInGroup1, groupNs)).toBe(false);
    expect(canPublishToNamespace(creatorOutside, groupNs)).toBe(false);

    // Only group manager (or admin) can manage (rename/transfer/delete) group namespace
    expect(canManageNamespace(creatorInGroup1, groupNs)).toBe(false);
    expect(canManageNamespace(managerInGroup1, groupNs)).toBe(true);
  });
});
