import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { TabsList, TabsTrigger } from "~/components/ui/tabs";
import { NAMESPACE_MAX_LENGTH, urlPartError } from "~/lib/dashboard/publicUrl";
import {
  ALL_PLATFORM_ROLES,
  PLATFORM_ROLE_RANK,
  canCreateGroupNamespace,
  formatGroupClaim,
  formatJwtTimestamp,
  getPlatformCapabilities,
  normalizeGroupName,
  type EffectiveGroupGrant,
  type GroupRight,
  type PlatformCapabilities,
  type PlatformRole,
} from "~/lib/groupAuth";

export interface UserProfileData {
  namespace: string;
  user?: {
    sub: string;
    name?: string;
    username?: string;
    email?: string;
    image?: string;
  };
  idpRole?: PlatformRole;
  platformRole?: PlatformRole;
  simulatedRole?: PlatformRole | null;
  capabilities?: PlatformCapabilities;
  allGrants: EffectiveGroupGrant[];
  activeGrants: EffectiveGroupGrant[];
  disabledGroups: string[];
  disableOwnerBypass: boolean;
  isAdmin: boolean;
  hasAdminClaim: boolean;
  isSimulating: boolean;
  jwtClaims?: Record<string, any> | null;
  jwtHeader?: Record<string, any> | null;
}

export interface UserProfileModalProps {
  onClose: () => void;
  onUpdated: (profile: UserProfileData) => void;
}

interface SpaceMemberRecord {
  id: string;
  group: string;
  username: string;
  displayName?: string;
  userSub?: string;
  rights: GroupRight[];
  claim: string;
  assignedBy?: string;
  updated_at?: string;
}

interface SpaceRecord {
  id: string;
  name: string;
  parent: string | null;
  owner: string;
  description?: string;
  canManage: boolean;
  canUse: boolean;
  members: SpaceMemberRecord[];
}

interface KnownUserRecord {
  sub: string;
  username: string;
  name?: string;
  email?: string;
  idpRole?: string;
}

type RolePreset = "manager" | "editor" | "maintainer" | "use" | "view" | "custom";

const RIGHT_BADGE_META: Record<
  GroupRight,
  { short: string; label: string; color: string }
> = {
  manager: {
    short: "M",
    label: "Manager (create sub-spaces, manage members & full resource access)",
    color: "border-amber-500/50 bg-amber-500/20 text-amber-300",
  },
  write: {
    short: "W",
    label: "Write / Edit resources in space",
    color: "border-blue-500/50 bg-blue-500/20 text-blue-300",
  },
  delete: {
    short: "D",
    label: "Delete resources in space",
    color: "border-rose-500/50 bg-rose-500/20 text-rose-300",
  },
  use: {
    short: "U",
    label: "Use / Trigger workflows & dashboards",
    color: "border-emerald-500/50 bg-emerald-500/20 text-emerald-300",
  },
  view: {
    short: "V",
    label: "View resources in space",
    color: "border-purple-500/50 bg-purple-500/20 text-purple-300",
  },
};

const PLATFORM_ROLE_META: Record<
  PlatformRole,
  {
    title: string;
    summary: string;
    badgeClass: string;
    activeCardClass: string;
  }
> = {
  admin: {
    title: "Admin",
    summary: "Full platform access: Library, Dashboards, Workflows, Requests, Connections, CAs, Protos & Database",
    badgeClass: "border-emerald-500/50 bg-emerald-500/20 text-emerald-300",
    activeCardClass: "border-emerald-500/60 bg-emerald-500/10 shadow-md shadow-emerald-500/10",
  },
  creator: {
    title: "Creator",
    summary: "Build & manage Workflows, Dashboards, Requests, Connections, Trusted CAs & Protos (no Database)",
    badgeClass: "border-blue-500/50 bg-blue-500/20 text-blue-300",
    activeCardClass: "border-blue-500/60 bg-blue-500/10 shadow-md shadow-blue-500/10",
  },
  user: {
    title: "User",
    summary: "Alter, create & use Dashboards and browse the Library",
    badgeClass: "border-cyan-500/50 bg-cyan-500/20 text-cyan-300",
    activeCardClass: "border-cyan-500/60 bg-cyan-500/10 shadow-md shadow-cyan-500/10",
  },
  viewer: {
    title: "Viewer",
    summary: "Use published & shared dashboards in the Library only",
    badgeClass: "border-zinc-600/60 bg-zinc-800/80 text-zinc-300",
    activeCardClass: "border-zinc-500/60 bg-zinc-800/40 shadow-md",
  },
};

export default function UserProfileModal(props: UserProfileModalProps) {
  let dialog!: HTMLDialogElement;
  const [activeTab, setActiveTab] = createSignal<"groups" | "manage" | "namespace" | "jwt">("groups");
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [successMsg, setSuccessMsg] = createSignal("");

  // Profile & simulation state
  const [profile, setProfile] = createSignal<UserProfileData | null>(null);
  const [namespace, setNamespace] = createSignal("");
  const [originalNamespace, setOriginalNamespace] = createSignal("");

  // JWT Inspection state
  const [jwtSearch, setJwtSearch] = createSignal("");
  const [copiedJson, setCopiedJson] = createSignal(false);
  const [showRawJson, setShowRawJson] = createSignal(false);
  const [showRawHeader, setShowRawHeader] = createSignal(false);

  // SurrealDB spaces & users state
  const [spaces, setSpaces] = createSignal<SpaceRecord[]>([]);
  const [existingGroupNames, setExistingGroupNames] = createSignal<string[]>([]);
  const [knownUsers, setKnownUsers] = createSignal<KnownUserRecord[]>([]);

  // Create Space form state
  const [newGroupName, setNewGroupName] = createSignal("");
  const [newGroupDesc, setNewGroupDesc] = createSignal("");
  const [creatingGroup, setCreatingGroup] = createSignal(false);

  // Manage Space Members & Rights form state (SurrealDB)
  const [selectedSpace, setSelectedSpace] = createSignal("");
  const [targetUsername, setTargetUsername] = createSignal("");
  const [rolePreset, setRolePreset] = createSignal<RolePreset>("use");
  const [customRights, setCustomRights] = createSignal<GroupRight[]>(["view", "use"]);
  const [assigningMember, setAssigningMember] = createSignal(false);
  const [removingUser, setRemovingUser] = createSignal<string | null>(null);
  const [deletingSpace, setDeletingSpace] = createSignal(false);

  // JWT inspection helpers
  const jwtClaimsMap = createMemo<Record<string, any>>(() => {
    return profile()?.jwtClaims || {};
  });

  const jwtHeaderMap = createMemo<Record<string, any>>(() => {
    return profile()?.jwtHeader || {};
  });

  const allJwtKeys = createMemo(() => {
    return Object.keys(jwtClaimsMap()).sort();
  });

  // Specifically extract groups and roles claims
  const detectedGroupClaims = createMemo(() => {
    const map = jwtClaimsMap();
    const result: { claimKey: string; items: string[] }[] = [];
    const extractList = (key: string, val: any) => {
      if (!val) return;
      if (Array.isArray(val)) {
        const strList = val.map((x) => String(x)).filter(Boolean);
        if (strList.length > 0) result.push({ claimKey: key, items: strList });
      } else if (typeof val === "string" && val.trim()) {
        result.push({ claimKey: key, items: [val.trim()] });
      }
    };
    extractList("groups", map.groups);
    extractList("roles", map.roles);
    extractList("entitlements", map.entitlements);
    extractList("group_permissions", map.group_permissions);
    if (map.realm_access && typeof map.realm_access === "object") {
      extractList("realm_access.roles", map.realm_access.roles);
    }
    if (map.resource_access && typeof map.resource_access === "object") {
      for (const [resClient, res] of Object.entries(map.resource_access)) {
        if (res && typeof res === "object" && Array.isArray((res as any).roles)) {
          extractList(`resource_access[${resClient}].roles`, (res as any).roles);
        }
      }
    }
    return result;
  });

  const filteredJwtKeys = createMemo(() => {
    const q = jwtSearch().toLowerCase().trim();
    const map = jwtClaimsMap();
    if (!q) return allJwtKeys();
    return allJwtKeys().filter((key) => {
      if (key.toLowerCase().includes(q)) return true;
      const val = map[key];
      try {
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        return str.toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  });

  const copyClaimsJson = async () => {
    const jsonStr = JSON.stringify(jwtClaimsMap(), null, 2);
    try {
      await navigator.clipboard.writeText(jsonStr);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // fallback
    }
  };

  const getClaimTypeMeta = (val: any) => {
    if (val === null) return { label: "null", color: "bg-zinc-800 text-zinc-400 border-zinc-700" };
    if (Array.isArray(val)) return { label: `array [${val.length}]`, color: "bg-purple-500/20 text-purple-300 border-purple-500/40" };
    if (typeof val === "object") return { label: "object", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" };
    if (typeof val === "boolean") return { label: "boolean", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
    if (typeof val === "number") return { label: "number", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
    return { label: "string", color: "bg-zinc-800 text-zinc-300 border-zinc-700" };
  };

  const loadAll = async () => {
    setError("");
    try {
      const [profRes, grpRes] = await Promise.all([
        fetch("/api/user/profile"),
        fetch("/api/user/groups"),
      ]);
      const profJson = await profRes.json();
      if (!profRes.ok || !profJson.success) {
        throw new Error(profJson.error || "Unable to load profile.");
      }
      setProfile(profJson.data);
      setNamespace(profJson.data.namespace || "");
      setOriginalNamespace(profJson.data.namespace || "");

      const grpJson = await grpRes.json().catch(() => ({}));
      if (grpJson.success && grpJson.data) {
        const loadedSpaces: SpaceRecord[] = Array.isArray(grpJson.data.groups)
          ? grpJson.data.groups
          : [];
        setSpaces(loadedSpaces);
        setExistingGroupNames(grpJson.data.existingGroupNames || []);
        setKnownUsers(Array.isArray(grpJson.data.knownUsers) ? grpJson.data.knownUsers : []);

        if (!selectedSpace() && loadedSpaces.length > 0) {
          const manageable = loadedSpaces.find((s) => s.canManage) || loadedSpaces[0];
          if (manageable) setSelectedSpace(manageable.name);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load user profile.");
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    dialog.showModal();
    await loadAll();
  });

  const emitProfileChange = (nextProfile: UserProfileData) => {
    setProfile(nextProfile);
    props.onUpdated(nextProfile);
    window.dispatchEvent(new CustomEvent("user-groups-changed", { detail: nextProfile }));
    window.dispatchEvent(new CustomEvent("user-namespace-changed", { detail: nextProfile }));
  };

  const updateSimulation = async (patch: {
    disabledGroups?: string[];
    disableOwnerBypass?: boolean;
    simulatedRole?: PlatformRole | null;
  }) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update perspective state.");
      }
      emitProfileChange(json.data);
    } catch (err: any) {
      setError(err?.message || "Failed to update perspective state.");
    } finally {
      setSaving(false);
    }
  };

  const selectSimulatedRole = async (role: PlatformRole) => {
    const p = profile();
    if (!p || saving()) return;
    const baseRole = p.idpRole || "viewer";
    const nextSim = role === baseRole ? null : role;
    await updateSimulation({ simulatedRole: nextSim });
  };

  const toggleGroupActive = async (groupName: string) => {
    const p = profile();
    if (!p || saving()) return;
    const norm = normalizeGroupName(groupName);
    const currentDisabled = new Set(p.disabledGroups || []);
    if (currentDisabled.has(norm)) {
      currentDisabled.delete(norm);
    } else {
      currentDisabled.add(norm);
    }
    await updateSimulation({
      disabledGroups: [...currentDisabled],
      disableOwnerBypass: p.disableOwnerBypass,
    });
  };

  const toggleOwnerBypass = async () => {
    const p = profile();
    if (!p || saving()) return;
    await updateSimulation({
      disabledGroups: p.disabledGroups || [],
      disableOwnerBypass: !p.disableOwnerBypass,
    });
  };

  const isolateSingleGroup = async (groupName: string, e: Event) => {
    e.stopPropagation();
    const p = profile();
    if (!p || saving()) return;
    const normTarget = normalizeGroupName(groupName);
    const otherGroups = (p.allGrants || [])
      .map((g) => g.group)
      .filter((g) => g !== normTarget);
    await updateSimulation({
      disabledGroups: otherGroups,
      disableOwnerBypass: true,
    });
  };

  const resetAllGroups = async () => {
    if (saving()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetSimulation: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to reset perspective.");
      }
      emitProfileChange(json.data);
    } catch (err: any) {
      setError(err?.message || "Failed to reset perspective.");
    } finally {
      setSaving(false);
    }
  };

  const effectiveIdpRole = createMemo<PlatformRole>(() => profile()?.idpRole || "viewer");
  const effectivePlatformRole = createMemo<PlatformRole>(() => profile()?.platformRole || effectiveIdpRole());
  const effectiveCapabilities = createMemo<PlatformCapabilities>(() =>
    profile()?.capabilities || getPlatformCapabilities(effectivePlatformRole())
  );

  const simulatableRoles = createMemo<PlatformRole[]>(() => {
    const maxRank = PLATFORM_ROLE_RANK[effectiveIdpRole()];
    return ALL_PLATFORM_ROLES.filter((r) => PLATFORM_ROLE_RANK[r] <= maxRank);
  });

  // Live preview of space creation rules
  const groupCreationCheck = createMemo(() => {
    const p = profile();
    const raw = newGroupName().trim();
    if (!raw || !p) return null;
    const role = effectivePlatformRole();
    return canCreateGroupNamespace(
      {
        sub: p.user?.sub || "anonymous",
        idpRole: effectiveIdpRole(),
        platformRole: role,
        simulatedRole: p.simulatedRole || null,
        capabilities: effectiveCapabilities(),
        allGrants: p.allGrants || [],
        activeGrants: p.activeGrants || [],
        disabledGroups: p.disabledGroups || [],
        disableOwnerBypass: p.disableOwnerBypass || false,
        isAdmin: p.isAdmin || false,
        hasAdminClaim: p.hasAdminClaim || false,
        isSimulating: p.isSimulating || false,
      },
      raw,
      existingGroupNames()
    );
  });

  const handleCreateGroup = async (e: SubmitEvent) => {
    e.preventDefault();
    if (creatingGroup() || !newGroupName().trim()) return;
    setCreatingGroup(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/user/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          groupName: newGroupName(),
          description: newGroupDesc(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create space in SurrealDB.");
      }
      const createdName = json.data?.group?.name || normalizeGroupName(newGroupName());
      setNewGroupName("");
      setNewGroupDesc("");
      setSelectedSpace(createdName);
      setSuccessMsg(
        `Created space "${createdName}" in SurrealDB and granted you "${createdName}:manager".`
      );
      await loadAll();
      if (profile()) {
        emitProfileChange(profile()!);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to create space.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const manageableSpaces = createMemo(() => {
    const p = profile();
    const list = spaces();
    if (p?.isAdmin) return list;
    return list.filter((s) => s.canManage);
  });

  const currentSpaceRecord = createMemo(() =>
    spaces().find((s) => s.name === selectedSpace()) || null
  );

  const selectedRightsArray = createMemo<GroupRight[]>(() => {
    switch (rolePreset()) {
      case "manager":
        return ["view", "use", "write", "delete", "manager"];
      case "maintainer":
        return ["view", "use", "write", "delete"];
      case "editor":
        return ["view", "use", "write"];
      case "use":
        return ["view", "use"];
      case "view":
        return ["view"];
      case "custom":
      default:
        return customRights();
    }
  });

  const previewAssignClaim = createMemo(() => {
    const grp = normalizeGroupName(selectedSpace() || "space");
    return formatGroupClaim(grp, selectedRightsArray());
  });

  const toggleCustomRight = (r: GroupRight) => {
    const cur = new Set(customRights());
    if (cur.has(r)) {
      if (cur.size > 1) cur.delete(r);
    } else {
      cur.add(r);
    }
    setCustomRights([...cur]);
  };

  const handleAssignMember = async (e: SubmitEvent) => {
    e.preventDefault();
    if (assigningMember() || !selectedSpace() || !targetUsername().trim()) return;
    setAssigningMember(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/user/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_member",
          groupName: selectedSpace(),
          targetUsername: targetUsername(),
          rights: selectedRightsArray(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save member rights in SurrealDB.");
      }
      setSuccessMsg(
        `Saved rights in SurrealDB: user "${json.data.targetUsername}" now has "${json.data.fullClaim}".`
      );
      setTargetUsername("");
      await loadAll();
      if (profile()) {
        emitProfileChange(profile()!);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to assign member rights.");
    } finally {
      setAssigningMember(false);
    }
  };

  const prefillMemberForEdit = (member: SpaceMemberRecord) => {
    setTargetUsername(member.username);
    const r = member.rights || [];
    if (r.includes("manager")) {
      setRolePreset("manager");
    } else if (r.includes("write") && r.includes("delete")) {
      setRolePreset("maintainer");
    } else if (r.includes("write")) {
      setRolePreset("editor");
    } else if (r.length === 1 && r[0] === "view") {
      setRolePreset("view");
    } else if (r.length === 2 && r.includes("view") && r.includes("use")) {
      setRolePreset("use");
    } else {
      setRolePreset("custom");
      setCustomRights([...r]);
    }
  };

  const handleRemoveMember = async (groupName: string, username: string) => {
    if (removingUser()) return;
    setRemovingUser(username);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/user/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_member",
          groupName,
          targetUsername: username,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to remove member.");
      }
      setSuccessMsg(`Removed "${username}" from space "${groupName}".`);
      await loadAll();
      if (profile()) {
        emitProfileChange(profile()!);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to remove member.");
    } finally {
      setRemovingUser(null);
    }
  };

  const handleDeleteSpace = async (groupName: string) => {
    if (deletingSpace() || !groupName) return;
    setDeletingSpace(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/user/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_group",
          groupName,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete space.");
      }
      setSelectedSpace("");
      setSuccessMsg(`Deleted space "${groupName}" and its member grants from SurrealDB.`);
      await loadAll();
      if (profile()) {
        emitProfileChange(profile()!);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete space.");
    } finally {
      setDeletingSpace(false);
    }
  };

  const saveNamespaceForm = async (e: SubmitEvent) => {
    e.preventDefault();
    if (loading() || saving()) return;
    const validation = urlPartError(namespace(), "Namespace");
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namespace: namespace() }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Unable to save your namespace.");
      }
      setOriginalNamespace(json.data.namespace || "");
      emitProfileChange(json.data);
      setSuccessMsg(`Saved public namespace "@${json.data.namespace}".`);
    } catch (err: any) {
      setError(err?.message || "Unable to save your namespace.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="user-profile-modal-title"
      onClose={() => props.onClose()}
      onCancel={(event) => {
        if (saving()) event.preventDefault();
      }}
      class="fixed m-auto w-[calc(100%-1.5rem)] max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700/90 bg-zinc-950 p-0 text-white shadow-2xl backdrop:bg-black/75"
    >
      {/* Top Profile Banner */}
      <div class="sticky top-0 z-20 border-b border-zinc-800/90 bg-zinc-950/95 backdrop-blur-xl px-6 py-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/40 text-lg font-bold text-purple-200">
              {(profile()?.user?.name || profile()?.user?.username || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 id="user-profile-modal-title" class="text-lg font-bold text-white truncate">
                  {profile()?.user?.name || profile()?.user?.username || "User Profile"}
                </h2>
                <Show when={profile()?.namespace}>
                  <Badge variant="purple" class="font-mono">
                    @{profile()?.namespace}
                  </Badge>
                </Show>
                <span
                  class={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-bold uppercase ${
                    PLATFORM_ROLE_META[effectivePlatformRole()].badgeClass
                  }`}
                  title={`FerrisKey Platform Role: ${effectiveIdpRole()}`}
                >
                  <span>Role: {effectivePlatformRole()}</span>
                  <Show when={profile()?.simulatedRole}>
                    <span class="text-[10px] text-amber-300 normal-case">
                      (simulating from {effectiveIdpRole()})
                    </span>
                  </Show>
                </span>
              </div>
              <p class="text-xs text-zinc-400 truncate font-mono mt-0.5">
                {profile()?.user?.email || profile()?.user?.sub || ""}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Show when={profile()?.isSimulating}>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={saving()}
                onClick={resetAllGroups}
                class="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/50 text-xs gap-1.5"
                title="Re-enable your full FerrisKey role, all spaces, and personal ownership view"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>Reset Perspective</span>
              </Button>
            </Show>
            <button
              type="button"
              onClick={() => dialog.close()}
              aria-label="Close profile"
              class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div class="mt-4 flex items-center justify-between gap-2 overflow-x-auto">
          <TabsList>
            <TabsTrigger
              active={activeTab() === "groups"}
              onClick={() => {
                setActiveTab("groups");
                setError("");
                setSuccessMsg("");
              }}
            >
              <span>Role, Spaces & Perspective</span>
              <Badge variant="secondary" class="ml-1.5 px-1.5 py-0 text-[10px]">
                {profile()?.activeGrants?.length || 0}/{profile()?.allGrants?.length || 0}
              </Badge>
            </TabsTrigger>
            <Show when={effectiveCapabilities().canManageGroups || profile()?.isAdmin}>
              <TabsTrigger
                active={activeTab() === "manage"}
                onClick={() => {
                  setActiveTab("manage");
                  setError("");
                  setSuccessMsg("");
                }}
              >
                Create & Manage Spaces (SurrealDB)
              </TabsTrigger>
            </Show>
            <TabsTrigger
              active={activeTab() === "namespace"}
              onClick={() => {
                setActiveTab("namespace");
                setError("");
                setSuccessMsg("");
              }}
            >
              Public Namespace
            </TabsTrigger>
            <TabsTrigger
              active={activeTab() === "jwt"}
              onClick={() => {
                setActiveTab("jwt");
                setError("");
                setSuccessMsg("");
              }}
            >
              <span>JWT Claims</span>
              <Badge variant="purple" class="ml-1.5 px-1.5 py-0 text-[10px]">
                {Object.keys(profile()?.jwtClaims || {}).length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* Modal Content */}
      <div class="p-6 space-y-5">
        <Show when={error()}>
          <div
            role="alert"
            class="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-xs text-rose-200 flex items-center justify-between"
          >
            <span>{error()}</span>
            <button
              type="button"
              onClick={() => setError("")}
              class="text-rose-400 hover:text-white ml-3"
            >
              ✕
            </button>
          </div>
        </Show>

        <Show when={successMsg()}>
          <div class="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-200 flex items-center justify-between">
            <span>{successMsg()}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg("")}
              class="text-emerald-400 hover:text-white ml-3"
            >
              ✕
            </button>
          </div>
        </Show>

        <Show
          when={!loading()}
          fallback={<div class="py-12 text-center text-sm text-zinc-400">Loading your role & SurrealDB spaces...</div>}
        >
          {/* TAB 1: ROLE, SPACES & PERSPECTIVE */}
          <Show when={activeTab() === "groups"}>
            <div class="space-y-5">
              {/* FerrisKey Platform Role & Interface Access */}
              <div class="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-4 space-y-3.5">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 class="text-sm font-bold text-white">
                      FerrisKey Interface Role & Perspective Simulator
                    </h3>
                    <p class="mt-0.5 text-xs text-zinc-400">
                      Your platform role comes from FerrisKey (<code class="text-zinc-200 font-mono">{effectiveIdpRole()}</code>).
                      <Show when={simulatableRoles().length > 1}>
                        {" "}Click any lower role below to preview how the interface looks for that role.
                      </Show>
                    </p>
                  </div>
                  <Badge variant="secondary" class="font-mono text-[10px]">
                    FerrisKey Role: {effectiveIdpRole().toUpperCase()}
                  </Badge>
                </div>

                {/* Role Switcher Cards */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <For each={simulatableRoles()}>
                    {(role) => {
                      const isCurrent = () => effectivePlatformRole() === role;
                      const meta = PLATFORM_ROLE_META[role];
                      return (
                        <button
                          type="button"
                          disabled={saving()}
                          onClick={() => selectSimulatedRole(role)}
                          class={`text-left rounded-xl border p-3 transition-all cursor-pointer ${
                            isCurrent()
                              ? meta.activeCardClass
                              : "border-zinc-800/80 bg-zinc-950/50 opacity-60 hover:opacity-95"
                          }`}
                        >
                          <div class="flex items-center justify-between gap-2">
                            <span class="font-mono text-xs font-bold uppercase text-white">
                              {meta.title}
                            </span>
                            <div class="flex items-center gap-1.5">
                              <Show when={role === effectiveIdpRole()}>
                                <span class="text-[10px] font-mono text-zinc-400">FerrisKey</span>
                              </Show>
                              <Badge variant={isCurrent() ? "success" : "secondary"} class="text-[10px] px-1.5 py-0">
                                {isCurrent() ? "Active" : "Preview"}
                              </Badge>
                            </div>
                          </div>
                          <p class="mt-1 text-[11px] text-zinc-400 leading-relaxed">
                            {meta.summary}
                          </p>
                        </button>
                      );
                    }}
                  </For>
                </div>

                {/* Active Interface Capabilities Strip */}
                <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/70 text-[11px]">
                  <span class="text-zinc-400 font-semibold mr-1">Unlocked Interface Areas:</span>
                  <span class="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300 font-mono">
                    ✓ Library
                  </span>
                  <span
                    class={`rounded border px-2 py-0.5 font-mono ${
                      effectiveCapabilities().canEditDashboards
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-500 line-through"
                    }`}
                  >
                    {effectiveCapabilities().canEditDashboards ? "✓" : "✗"} Dashboards
                  </span>
                  <span
                    class={`rounded border px-2 py-0.5 font-mono ${
                      effectiveCapabilities().canManageWorkflows
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-500 line-through"
                    }`}
                  >
                    {effectiveCapabilities().canManageWorkflows ? "✓" : "✗"} Workflows & Requests
                  </span>
                  <span
                    class={`rounded border px-2 py-0.5 font-mono ${
                      effectiveCapabilities().canManageConnections
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-500 line-through"
                    }`}
                  >
                    {effectiveCapabilities().canManageConnections ? "✓" : "✗"} Connections / CAs / Protos
                  </span>
                  <span
                    class={`rounded border px-2 py-0.5 font-mono ${
                      effectiveCapabilities().canManageDatabase
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-500 line-through"
                    }`}
                  >
                    {effectiveCapabilities().canManageDatabase ? "✓" : "✗"} Database
                  </span>
                </div>
              </div>

              {/* Personal Creator Ownership Toggle (@owner) */}
              <div class="space-y-2">
                <div class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Personal Creator Access
                </div>
                <div
                  onClick={toggleOwnerBypass}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleOwnerBypass();
                    }
                  }}
                  class={`flex items-center justify-between gap-3 rounded-xl border p-3.5 cursor-pointer transition-all select-none ${
                    !profile()?.disableOwnerBypass
                      ? "border-blue-500/60 bg-blue-500/10 shadow-md shadow-blue-500/10"
                      : "border-zinc-800/80 bg-zinc-900/30 opacity-45 hover:opacity-75"
                  }`}
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <span
                      class={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        !profile()?.disableOwnerBypass ? "bg-blue-400 shadow-sm shadow-blue-400" : "bg-zinc-600"
                      }`}
                    />
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-sm font-bold text-white">@owner</span>
                        <Badge variant="blue" class="text-[10px] px-2 py-0">
                          Personal Ownership
                        </Badge>
                      </div>
                      <p class="text-xs text-zinc-400 mt-0.5">
                        View and manage all private/untagged resources you created. Turn off when testing another space's exact view.
                      </p>
                    </div>
                  </div>
                  <Badge variant={!profile()?.disableOwnerBypass ? "success" : "secondary"}>
                    {!profile()?.disableOwnerBypass ? "Active" : "Deactivated"}
                  </Badge>
                </div>
              </div>

              {/* SurrealDB Space Grants List */}
              <div class="space-y-2.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Your SurrealDB Spaces ({profile()?.activeGrants?.length || 0} active of {profile()?.allGrants?.length || 0})
                  </span>
                  <div class="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span>Rights:</span>
                    <span class="font-mono text-amber-300">M=Manager</span>
                    <span class="font-mono text-blue-300">W=Write</span>
                    <span class="font-mono text-rose-300">D=Delete</span>
                    <span class="font-mono text-emerald-300">U=Use</span>
                    <span class="font-mono text-purple-300">V=View</span>
                  </div>
                </div>

                <Show
                  when={(profile()?.allGrants?.length || 0) > 0}
                  fallback={
                    <div class="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center">
                      <p class="text-sm font-semibold text-zinc-300">No spaces assigned in SurrealDB yet</p>
                      <p class="mt-1 text-xs text-zinc-500">
                        Spaces and fine-grained resource rights are stored directly in SurrealDB.
                        <Show when={effectiveCapabilities().canManageGroups || profile()?.isAdmin}>
                          {" "}You can create a new space or assign members in the{" "}
                          <button
                            type="button"
                            onClick={() => setActiveTab("manage")}
                            class="text-purple-400 underline hover:text-purple-300"
                          >
                            Create & Manage Spaces
                          </button>{" "}
                          tab.
                        </Show>
                      </p>
                    </div>
                  }
                >
                  <div class="grid grid-cols-1 gap-2.5">
                    <For each={profile()?.allGrants || []}>
                      {(grant) => (
                        <div
                          onClick={() => toggleGroupActive(grant.group)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleGroupActive(grant.group);
                            }
                          }}
                          class={`group flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 cursor-pointer transition-all select-none ${
                            grant.active
                              ? "border-purple-500/60 bg-purple-500/10 shadow-md shadow-purple-500/10"
                              : "border-zinc-800/80 bg-zinc-900/30 opacity-45 hover:opacity-75"
                          }`}
                        >
                          <div class="flex items-center gap-3 min-w-0">
                            <span
                              class={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                grant.active
                                  ? "bg-purple-400 shadow-sm shadow-purple-400"
                                  : "bg-zinc-600"
                              }`}
                            />
                            <div class="min-w-0">
                              <div class="flex flex-wrap items-center gap-2">
                                <span
                                  class={`font-mono text-sm font-bold ${
                                    grant.active ? "text-white" : "text-zinc-400 line-through"
                                  }`}
                                >
                                  {grant.group}
                                </span>
                                <span class="font-mono text-[11px] text-zinc-400">
                                  {grant.raw}
                                </span>
                                <Badge
                                  variant={grant.source === "tagged" ? "secondary" : "purple"}
                                  class="text-[10px] px-2 py-0"
                                >
                                  {grant.source === "tagged" ? "Tagged Resource" : "SurrealDB Space"}
                                </Badge>
                              </div>
                              <div class="mt-1.5 flex flex-wrap items-center gap-1">
                                <For each={grant.rights}>
                                  {(r) => (
                                    <span
                                      title={RIGHT_BADGE_META[r].label}
                                      class={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${RIGHT_BADGE_META[r].color}`}
                                    >
                                      <span>{RIGHT_BADGE_META[r].short}</span>
                                      <span class="capitalize">{r}</span>
                                    </span>
                                  )}
                                </For>
                              </div>
                            </div>
                          </div>

                          <div class="flex items-center gap-2 ml-auto">
                            <button
                              type="button"
                              onClick={(e) => isolateSingleGroup(grant.group, e)}
                              title={`Isolate "${grant.group}" — deactivate all other spaces & @owner to see strictly what this space sees`}
                              class="rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-purple-500/50 hover:text-purple-200 transition-colors"
                            >
                              Solo View
                            </button>
                            <Badge variant={grant.active ? "success" : "secondary"}>
                              {grant.active ? "Active" : "Off"}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          {/* TAB 2: CREATE & MANAGE SPACES (DIRECTLY IN SURREALDB) */}
          <Show when={activeTab() === "manage"}>
            <div class="space-y-6">
              {/* Section 1: Create Space Namespace in SurrealDB */}
              <form
                onSubmit={handleCreateGroup}
                class="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-5 space-y-4"
              >
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 class="text-base font-bold text-white">Create Space (Group Namespace)</h3>
                    <p class="mt-0.5 text-xs text-zinc-400">
                      Create a root space (e.g. <code class="text-purple-300">group1</code>) or a hierarchical sub-space (e.g. <code class="text-purple-300">group1.test1</code>) if you have <code class="text-amber-300">group1:manager</code>. Stored directly in SurrealDB.
                    </p>
                  </div>
                  <Badge variant="amber" class="text-[10px]">
                    Grants Permanent :manager in SurrealDB
                  </Badge>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="block text-xs font-semibold text-zinc-300">
                      Space Name (use "." for hierarchy)
                    </label>
                    <Input
                      value={newGroupName()}
                      onInput={(e) => {
                        setNewGroupName(e.currentTarget.value);
                        setError("");
                      }}
                      placeholder="e.g. group1 or group1.test1"
                      class="font-mono"
                    />
                    <Show when={groupCreationCheck()}>
                      {(chk) => (
                        <div
                          class={`text-[11px] font-mono ${
                            chk().allowed ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          <Show when={chk().allowed} fallback={<span>✗ {chk().error}</span>}>
                            <span>
                              ✓ Valid {chk().parent ? `sub-space under "${chk().parent}"` : "root space"} — will grant{" "}
                              <strong>{chk().normalized}:manager</strong> in SurrealDB
                            </span>
                          </Show>
                        </div>
                      )}
                    </Show>
                  </div>

                  <div class="space-y-1.5">
                    <label class="block text-xs font-semibold text-zinc-300">
                      Description (Optional)
                    </label>
                    <Input
                      value={newGroupDesc()}
                      onInput={(e) => setNewGroupDesc(e.currentTarget.value)}
                      placeholder="Team or project space description"
                    />
                  </div>
                </div>

                <div class="flex justify-end pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={
                      creatingGroup() ||
                      !newGroupName().trim() ||
                      Boolean(groupCreationCheck() && !groupCreationCheck()!.allowed)
                    }
                  >
                    {creatingGroup() ? "Creating in SurrealDB..." : "Create Space"}
                  </Button>
                </div>
              </form>

              {/* Section 2: Manage Space Members & Rights in SurrealDB */}
              <div class="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-5 space-y-5">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 class="text-base font-bold text-white">
                      Manage Space Members & Rights
                    </h3>
                    <p class="mt-0.5 text-xs text-zinc-400">
                      Assign or update user permissions on your spaces directly in SurrealDB. Grants on a parent space (e.g. <code class="text-purple-300">group1</code>) automatically inherit downward to sub-spaces (<code class="text-purple-300">group1.test1</code>).
                    </p>
                  </div>
                  <Badge variant="purple" class="text-[10px]">
                    Stored in SurrealDB
                  </Badge>
                </div>

                <Show
                  when={manageableSpaces().length > 0}
                  fallback={
                    <div class="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 p-6 text-center text-xs text-zinc-400">
                      You don't manage any spaces yet. Create a space above to start assigning users and rights.
                    </div>
                  }
                >
                  <form onSubmit={handleAssignMember} class="space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div class="space-y-1.5">
                        <label class="block text-xs font-semibold text-zinc-300">
                          Target Space
                        </label>
                        <select
                          value={selectedSpace()}
                          onChange={(e) => setSelectedSpace(e.currentTarget.value)}
                          class="w-full h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 font-mono text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">Select a space...</option>
                          <For each={manageableSpaces()}>
                            {(s) => (
                              <option value={s.name}>
                                {s.name} ({s.members?.length || 0} member{(s.members?.length || 0) === 1 ? "" : "s"})
                              </option>
                            )}
                          </For>
                        </select>
                      </div>

                      <div class="space-y-1.5">
                        <label class="block text-xs font-semibold text-zinc-300">
                          User (Username, Email, or ID)
                        </label>
                        <Input
                          value={targetUsername()}
                          onInput={(e) => setTargetUsername(e.currentTarget.value)}
                          placeholder="Select or type username (e.g. alice)"
                          list="surrealdb-known-users-list"
                          autocomplete="off"
                          spellcheck={false}
                          class="font-mono"
                        />
                        <datalist id="surrealdb-known-users-list">
                          <For each={knownUsers()}>
                            {(u) => (
                              <option value={u.username}>
                                {u.name ? `${u.name} (${u.idpRole || "user"})` : u.email || u.sub}
                              </option>
                            )}
                          </For>
                        </datalist>
                      </div>
                    </div>

                    {/* Role / Rights Presets */}
                    <div class="space-y-2">
                      <label class="block text-xs font-semibold text-zinc-300">
                        Space Role / Rights Preset
                      </label>
                      <div class="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRolePreset("manager")}
                          class={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            rolePreset() === "manager"
                              ? "border-amber-500 bg-amber-500/20 text-amber-200"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Manager (M, W, D, U, V)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRolePreset("maintainer")}
                          class={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            rolePreset() === "maintainer"
                              ? "border-rose-500 bg-rose-500/20 text-rose-200"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Maintainer (W, D, U, V)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRolePreset("editor")}
                          class={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            rolePreset() === "editor"
                              ? "border-blue-500 bg-blue-500/20 text-blue-200"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Editor (W, U, V)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRolePreset("use")}
                          class={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            rolePreset() === "use"
                              ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Operator (U, V)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRolePreset("view")}
                          class={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            rolePreset() === "view"
                              ? "border-purple-500 bg-purple-500/20 text-purple-200"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Viewer (V)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRolePreset("custom")}
                          class={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            rolePreset() === "custom"
                              ? "border-purple-500 bg-purple-500/20 text-purple-200"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Custom Rights (...)
                        </button>
                      </div>

                      <Show when={rolePreset() === "custom"}>
                        <div class="flex flex-wrap items-center gap-2 pt-1">
                          <For each={["view", "use", "write", "delete", "manager"] as GroupRight[]}>
                            {(r) => (
                              <label class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={customRights().includes(r)}
                                  onChange={() => toggleCustomRight(r)}
                                />
                                <span class="font-mono">{r}</span>
                              </label>
                            )}
                          </For>
                        </div>
                      </Show>

                      <div class="rounded-lg bg-zinc-950 border border-zinc-800/80 px-3 py-2 text-xs flex items-center justify-between">
                        <span class="text-zinc-400">SurrealDB Space Grant:</span>
                        <code class="font-mono font-bold text-purple-300">{previewAssignClaim()}</code>
                      </div>
                    </div>

                    <div class="flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={
                          assigningMember() ||
                          !selectedSpace() ||
                          !targetUsername().trim()
                        }
                      >
                        {assigningMember() ? "Saving..." : "Save Member Rights"}
                      </Button>
                    </div>
                  </form>

                  {/* Current Members List for Selected Space */}
                  <Show when={currentSpaceRecord()}>
                    {(space) => (
                      <div class="pt-4 border-t border-zinc-800/80 space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="flex items-center gap-2">
                            <h4 class="text-xs font-bold uppercase tracking-wider text-zinc-300">
                              Members in <span class="font-mono text-purple-300">{space().name}</span>
                            </h4>
                            <Badge variant="secondary" class="text-[10px]">
                              {space().members?.length || 0}
                            </Badge>
                          </div>
                          <Show when={space().canManage}>
                            <button
                              type="button"
                              disabled={deletingSpace()}
                              onClick={() => handleDeleteSpace(space().name)}
                              class="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                            >
                              {deletingSpace() ? "Deleting Space..." : `Delete Space "${space().name}"`}
                            </button>
                          </Show>
                        </div>

                        <Show
                          when={(space().members?.length || 0) > 0}
                          fallback={
                            <p class="text-xs text-zinc-500 italic">
                              No explicit members recorded for this space yet. Use the form above to grant users access.
                            </p>
                          }
                        >
                          <div class="divide-y divide-zinc-800/70 rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
                            <For each={space().members}>
                              {(mem) => (
                                <div class="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
                                  <div class="flex items-center gap-2.5 min-w-0">
                                    <span class="font-mono font-bold text-white truncate">
                                      {mem.displayName || mem.username}
                                    </span>
                                    <div class="flex flex-wrap items-center gap-1">
                                      <For each={mem.rights}>
                                        {(r) => (
                                          <span
                                            title={RIGHT_BADGE_META[r].label}
                                            class={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${RIGHT_BADGE_META[r].color}`}
                                          >
                                            <span>{RIGHT_BADGE_META[r].short}</span>
                                            <span class="capitalize">{r}</span>
                                          </span>
                                        )}
                                      </For>
                                    </div>
                                  </div>

                                  <div class="flex items-center gap-2 ml-auto">
                                    <button
                                      type="button"
                                      onClick={() => prefillMemberForEdit(mem)}
                                      class="rounded-md border border-zinc-700/80 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:border-purple-500/50 hover:text-white transition-colors"
                                    >
                                      Edit Rights
                                    </button>
                                    <button
                                      type="button"
                                      disabled={removingUser() === mem.username}
                                      onClick={() => handleRemoveMember(space().name, mem.username)}
                                      class="rounded-md border border-rose-500/30 bg-rose-950/30 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-900/50 transition-colors"
                                    >
                                      {removingUser() === mem.username ? "..." : "Remove"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )}
                  </Show>
                </Show>
              </div>
            </div>
          </Show>

          {/* TAB 3: PUBLIC NAMESPACE */}
          <Show when={activeTab() === "namespace"}>
            <form onSubmit={saveNamespaceForm} class="space-y-4">
              <div>
                <h3 class="text-base font-bold text-white">Public Dashboard Namespace</h3>
                <p class="mt-1 text-xs text-zinc-400">
                  Choose the URL namespace used when you publish dashboards publicly.
                </p>
              </div>
              <div class="space-y-2">
                <label for="user-namespace-input" class="text-xs font-semibold text-zinc-300">
                  Namespace
                </label>
                <Input
                  id="user-namespace-input"
                  value={namespace()}
                  disabled={saving()}
                  placeholder="my-team"
                  maxLength={NAMESPACE_MAX_LENGTH}
                  autocomplete="off"
                  spellcheck={false}
                  onInput={(event) => {
                    setNamespace(event.currentTarget.value.toLowerCase().trim());
                    setError("");
                  }}
                />
                <p class="text-xs text-zinc-400">
                  Lowercase letters, numbers, and hyphens. Must be unique.
                </p>
                <p class="break-all rounded-lg bg-zinc-900 p-3 font-mono text-xs text-purple-300">
                  /p/{namespace() || "your-namespace"}/dashboard-name
                </p>
                <Show when={originalNamespace() && originalNamespace() !== namespace()}>
                  <p class="text-xs text-amber-300">
                    Changing your namespace updates all your published dashboard URLs atomically.
                  </p>
                </Show>
              </div>
              <div class="flex justify-end gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={saving()}
                >
                  {saving() ? "Saving..." : "Save Namespace"}
                </Button>
              </div>
            </form>
          </Show>

          {/* TAB 4: JWT CLAIMS INSPECTION */}
          <Show when={activeTab() === "jwt"}>
            <div class="space-y-4">
              <div>
                <h3 class="text-base font-bold text-white">JWT Claims Inspector</h3>
                <p class="mt-1 text-xs text-zinc-400">
                  Inspect the decoded OIDC JWT token claims, including FerrisKey groups, roles, and subject metadata.
                </p>
              </div>

              <Show
                when={allJwtKeys().length > 0}
                fallback={
                  <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center space-y-2">
                    <div class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <h4 class="text-sm font-bold text-white">No Parsed JWT Available</h4>
                    <p class="text-xs text-zinc-400 max-w-md mx-auto">
                      No decoded JWT ID or access token claims were found for your current session.
                      When authenticated via FerrisKey or OIDC, all token claims (including group and role claims)
                      are captured and inspected here.
                    </p>
                  </div>
                }
              >
                {/* Hero Card: Group & Role Claims */}
                <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Group & Role Claims
                      </span>
                      <Badge variant="purple" class="text-[10px]">
                        FerrisKey / OIDC
                      </Badge>
                    </div>
                    <span class="text-[11px] text-zinc-400">
                      {detectedGroupClaims().reduce((acc, c) => acc + c.items.length, 0)} total values
                    </span>
                  </div>
                  <Show
                    when={detectedGroupClaims().length > 0}
                    fallback={
                      <p class="text-xs text-zinc-400 italic">
                        No explicit group or role claims (e.g. groups, roles, realm_access) detected in the current JWT token payload.
                      </p>
                    }
                  >
                    <div class="space-y-2 mt-2">
                      <For each={detectedGroupClaims()}>
                        {(groupClaim) => (
                          <div class="rounded-lg bg-zinc-950/70 p-2.5 border border-zinc-800/80">
                            <div class="text-[11px] font-mono font-semibold text-purple-300 mb-1.5 flex items-center gap-2">
                              <span>{groupClaim.claimKey}</span>
                              <span class="text-zinc-500 text-[10px]">
                                ({groupClaim.items.length})
                              </span>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                              <For each={groupClaim.items}>
                                {(item) => (
                                  <span class="inline-flex items-center rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 font-mono text-xs text-purple-200">
                                    {item}
                                  </span>
                                )}
                              </For>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* Identity & Lifecycle Info */}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                    <div class="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                      Identity Claims
                    </div>
                    <dl class="space-y-1.5 text-xs font-mono">
                      <div class="flex justify-between gap-2">
                        <dt class="text-zinc-500">sub:</dt>
                        <dd class="text-zinc-200 truncate" title={jwtClaimsMap().sub || "—"}>
                          {jwtClaimsMap().sub || "—"}
                        </dd>
                      </div>
                      <div class="flex justify-between gap-2">
                        <dt class="text-zinc-500">username / name:</dt>
                        <dd class="text-zinc-200 truncate">
                          {jwtClaimsMap().preferred_username || jwtClaimsMap().name || "—"}
                        </dd>
                      </div>
                      <div class="flex justify-between gap-2">
                        <dt class="text-zinc-500">email:</dt>
                        <dd class="text-zinc-200 truncate">{jwtClaimsMap().email || "—"}</dd>
                      </div>
                      <div class="flex justify-between gap-2">
                        <dt class="text-zinc-500">iss:</dt>
                        <dd class="text-zinc-400 truncate text-[11px]" title={jwtClaimsMap().iss || "—"}>
                          {jwtClaimsMap().iss || "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Token Lifecycle
                      </span>
                      <Show when={jwtClaimsMap().exp}>
                        {(() => {
                          const isExpired = Date.now() / 1000 > Number(jwtClaimsMap().exp);
                          return (
                            <span
                              class={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border ${
                                isExpired
                                  ? "bg-red-500/20 text-red-300 border-red-500/40"
                                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              }`}
                            >
                              {isExpired ? "Expired" : "Active"}
                            </span>
                          );
                        })()}
                      </Show>
                    </div>
                    <dl class="space-y-1.5 text-xs font-mono">
                      <div class="flex justify-between gap-2">
                        <dt class="text-zinc-500">Issued (iat):</dt>
                        <dd class="text-zinc-300">
                          {formatJwtTimestamp(jwtClaimsMap().iat) || "—"}
                        </dd>
                      </div>
                      <div class="flex justify-between gap-2">
                        <dt class="text-zinc-500">Expires (exp):</dt>
                        <dd class="text-zinc-300">
                          {formatJwtTimestamp(jwtClaimsMap().exp) || "—"}
                        </dd>
                      </div>
                      <Show when={jwtClaimsMap().auth_time}>
                        <div class="flex justify-between gap-2">
                          <dt class="text-zinc-500">Auth Time:</dt>
                          <dd class="text-zinc-300">
                            {formatJwtTimestamp(jwtClaimsMap().auth_time)}
                          </dd>
                        </div>
                      </Show>
                    </dl>
                  </div>
                </div>

                {/* Search Bar & Viewer Toggles */}
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div class="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Filter claims by key or value..."
                      value={jwtSearch()}
                      onInput={(e) => setJwtSearch(e.currentTarget.value)}
                      class="h-8 text-xs"
                    />
                  </div>
                  <div class="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      class="h-8 text-xs gap-1 border-zinc-700"
                      onClick={() => setShowRawHeader(!showRawHeader())}
                    >
                      <span>Header</span>
                      <Badge variant="secondary" class="text-[9px] px-1 py-0">
                        {Object.keys(jwtHeaderMap()).length}
                      </Badge>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      class="h-8 text-xs gap-1 border-zinc-700"
                      onClick={() => setShowRawJson(!showRawJson())}
                    >
                      <span>{showRawJson() ? "Hide JSON" : "Raw JSON"}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      class="h-8 text-xs gap-1"
                      onClick={copyClaimsJson}
                    >
                      <Show when={copiedJson()} fallback={<span>Copy JSON</span>}>
                        <span class="text-emerald-300">✓ Copied!</span>
                      </Show>
                    </Button>
                  </div>
                </div>

                {/* Collapsible Decoded Header */}
                <Show when={showRawHeader()}>
                  <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                    <div class="flex items-center justify-between text-xs text-zinc-400">
                      <span class="font-bold text-zinc-200">Decoded JWT Header (JOSE)</span>
                      <span class="font-mono text-[11px] text-zinc-500">
                        Algorithm: {jwtHeaderMap().alg || "none"}
                      </span>
                    </div>
                    <pre class="p-2 rounded bg-zinc-900 font-mono text-xs text-cyan-300 overflow-x-auto border border-zinc-800/80">
                      {JSON.stringify(jwtHeaderMap(), null, 2)}
                    </pre>
                  </div>
                </Show>

                {/* Collapsible Raw JSON Viewer */}
                <Show when={showRawJson()}>
                  <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                    <div class="flex items-center justify-between text-xs text-zinc-400">
                      <span class="font-bold text-zinc-200">Full JWT Claims JSON</span>
                      <span class="font-mono text-[11px] text-zinc-500">
                        {allJwtKeys().length} claims
                      </span>
                    </div>
                    <pre class="p-2 rounded bg-zinc-900 font-mono text-xs text-emerald-300 overflow-x-auto max-h-72 border border-zinc-800/80">
                      {JSON.stringify(jwtClaimsMap(), null, 2)}
                    </pre>
                  </div>
                </Show>

                {/* Structured Claims Table */}
                <div class="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                  <div class="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/60 border-b border-zinc-800">
                    <span class="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Decoded Token Claims
                    </span>
                    <span class="text-xs text-zinc-400 font-mono">
                      Showing {filteredJwtKeys().length} of {allJwtKeys().length} claims
                    </span>
                  </div>
                  <div class="overflow-x-auto max-h-[380px]">
                    <table class="w-full text-left border-collapse">
                      <thead class="sticky top-0 bg-zinc-900 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th class="px-3 py-2 w-1/4">Claim Key</th>
                          <th class="px-3 py-2 w-28">Type</th>
                          <th class="px-3 py-2">Decoded Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <Show
                          when={filteredJwtKeys().length > 0}
                          fallback={
                            <tr>
                              <td colspan={3} class="px-4 py-8 text-center text-xs text-zinc-500 italic">
                                {jwtSearch() ? "No claims matching your filter." : "No claims found."}
                              </td>
                            </tr>
                          }
                        >
                          <For each={filteredJwtKeys()}>
                            {(key) => {
                              const val = () => jwtClaimsMap()[key];
                              const isTimestamp = () =>
                                ["exp", "iat", "auth_time", "nbf"].includes(key) &&
                                typeof val() === "number";
                              const typeMeta = () => getClaimTypeMeta(val());

                              return (
                                <tr class="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors">
                                  <td class="px-3 py-2.5 align-top font-mono text-xs font-semibold text-purple-300">
                                    {key}
                                  </td>
                                  <td class="px-3 py-2.5 align-top">
                                    <span
                                      class={`inline-block rounded px-1.5 py-0.5 text-[10px] font-mono border ${typeMeta().color}`}
                                    >
                                      {typeMeta().label}
                                    </span>
                                  </td>
                                  <td class="px-3 py-2.5 align-top text-xs text-zinc-200">
                                    <Show when={isTimestamp()}>
                                      <div class="flex items-center gap-2 flex-wrap">
                                        <span class="font-mono text-emerald-300">
                                          {formatJwtTimestamp(val())}
                                        </span>
                                        <span class="font-mono text-[11px] text-zinc-500">
                                          ({String(val())})
                                        </span>
                                      </div>
                                    </Show>
                                    <Show when={!isTimestamp() && Array.isArray(val())}>
                                      <div class="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                                        <For each={val() as any[]}>
                                          {(item) => (
                                            <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200 border border-zinc-700/60">
                                              {typeof item === "object" ? JSON.stringify(item) : String(item)}
                                            </span>
                                          )}
                                        </For>
                                      </div>
                                    </Show>
                                    <Show when={!isTimestamp() && !Array.isArray(val()) && typeof val() === "object" && val() !== null}>
                                      <pre class="rounded bg-zinc-900/90 p-2 font-mono text-[11px] text-zinc-300 max-h-40 overflow-y-auto border border-zinc-800">
                                        {JSON.stringify(val(), null, 2)}
                                      </pre>
                                    </Show>
                                    <Show when={!isTimestamp() && !Array.isArray(val()) && (typeof val() !== "object" || val() === null)}>
                                      <Show when={typeof val() === "boolean"}>
                                        <span
                                          class={`inline-block rounded px-2 py-0.5 text-xs font-mono font-bold ${
                                            val() ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                                          }`}
                                        >
                                          {String(val())}
                                        </span>
                                      </Show>
                                      <Show when={typeof val() !== "boolean"}>
                                        <span class="break-all font-mono text-zinc-200">
                                          {val() === null ? "null" : String(val())}
                                        </span>
                                      </Show>
                                    </Show>
                                  </td>
                                </tr>
                              );
                            }}
                          </For>
                        </Show>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </dialog>
  );
}
