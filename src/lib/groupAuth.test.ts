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
});
