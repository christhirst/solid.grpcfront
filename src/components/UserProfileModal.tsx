import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { TabsList, TabsTrigger } from "~/components/ui/tabs";
import { NAMESPACE_MAX_LENGTH, urlPartError } from "~/lib/dashboard/publicUrl";
import {
  canCreateGroupNamespace,
  formatGroupClaim,
  normalizeGroupName,
  type EffectiveGroupGrant,
  type GroupRight,
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
  allGrants: EffectiveGroupGrant[];
  activeGrants: EffectiveGroupGrant[];
  disabledGroups: string[];
  disableOwnerBypass: boolean;
  isAdmin: boolean;
  hasAdminClaim: boolean;
  isSimulating: boolean;
}

export interface UserProfileModalProps {
  onClose: () => void;
  onUpdated: (profile: UserProfileData) => void;
}

const RIGHT_BADGE_META: Record<
  GroupRight,
  { short: string; label: string; color: string }
> = {
  manager: {
    short: "M",
    label: "Manager (create sub-groups & full access)",
    color: "border-amber-500/50 bg-amber-500/20 text-amber-300",
  },
  write: {
    short: "W",
    label: "Write / Edit",
    color: "border-blue-500/50 bg-blue-500/20 text-blue-300",
  },
  delete: {
    short: "D",
    label: "Delete",
    color: "border-rose-500/50 bg-rose-500/20 text-rose-300",
  },
  use: {
    short: "U",
    label: "Use / Trigger Workflows",
    color: "border-emerald-500/50 bg-emerald-500/20 text-emerald-300",
  },
  view: {
    short: "V",
    label: "View",
    color: "border-purple-500/50 bg-purple-500/20 text-purple-300",
  },
};

export default function UserProfileModal(props: UserProfileModalProps) {
  let dialog!: HTMLDialogElement;
  const [activeTab, setActiveTab] = createSignal<"groups" | "manage" | "namespace">("groups");
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [successMsg, setSuccessMsg] = createSignal("");

  // Profile & simulation state
  const [profile, setProfile] = createSignal<UserProfileData | null>(null);
  const [namespace, setNamespace] = createSignal("");
  const [originalNamespace, setOriginalNamespace] = createSignal("");

  // Group registry & workflows state
  const [existingGroupNames, setExistingGroupNames] = createSignal<string[]>([]);
  const [workflows, setWorkflows] = createSignal<any[]>([]);

  // Create Group form state
  const [newGroupName, setNewGroupName] = createSignal("");
  const [newGroupDesc, setNewGroupDesc] = createSignal("");
  const [createWorkflowId, setCreateWorkflowId] = createSignal("");
  const [creatingGroup, setCreatingGroup] = createSignal(false);

  // Assign Member in IdP via Workflow form state (strictly no user discovery)
  const [assignGroup, setAssignGroup] = createSignal("");
  const [targetUsername, setTargetUsername] = createSignal("");
  const [rolePreset, setRolePreset] = createSignal<"manager" | "use" | "custom">("manager");
  const [customRights, setCustomRights] = createSignal<GroupRight[]>(["view", "use"]);
  const [assignWorkflowId, setAssignWorkflowId] = createSignal("");
  const [assigningMember, setAssigningMember] = createSignal(false);

  const loadAll = async () => {
    setError("");
    try {
      const [profRes, grpRes, wfRes] = await Promise.all([
        fetch("/api/user/profile"),
        fetch("/api/user/groups"),
        fetch("/api/workflows"),
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
        setExistingGroupNames(grpJson.data.existingGroupNames || []);
      }

      const wfJson = await wfRes.json().catch(() => ({}));
      if (wfJson.success && Array.isArray(wfJson.data)) {
        setWorkflows(wfJson.data);
        if (!assignWorkflowId() && wfJson.data.length > 0) {
          setAssignWorkflowId(wfJson.data[0].id);
        }
      }

      // Default assignGroup to first group with manager or use right
      const grants: EffectiveGroupGrant[] = profJson.data.allGrants || [];
      if (!assignGroup() && grants.length > 0) {
        const usable = grants.find(
          (g) => g.rights.includes("manager") || g.rights.includes("use")
        );
        if (usable) setAssignGroup(usable.group);
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

  const updateSimulation = async (
    nextDisabledGroups: string[],
    nextDisableOwnerBypass: boolean
  ) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disabledGroups: nextDisabledGroups,
          disableOwnerBypass: nextDisableOwnerBypass,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update group state.");
      }
      emitProfileChange(json.data);
    } catch (err: any) {
      setError(err?.message || "Failed to update group state.");
    } finally {
      setSaving(false);
    }
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
    await updateSimulation([...currentDisabled], p.disableOwnerBypass);
  };

  const toggleOwnerBypass = async () => {
    const p = profile();
    if (!p || saving()) return;
    await updateSimulation(p.disabledGroups || [], !p.disableOwnerBypass);
  };

  const isolateSingleGroup = async (groupName: string, e: Event) => {
    e.stopPropagation();
    const p = profile();
    if (!p || saving()) return;
    const normTarget = normalizeGroupName(groupName);
    const otherGroups = (p.allGrants || [])
      .map((g) => g.group)
      .filter((g) => g !== normTarget);
    // Disable all other groups AND disable personal @owner bypass to see strictly what this group sees
    await updateSimulation(otherGroups, true);
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
        throw new Error(json.error || "Failed to reset groups.");
      }
      emitProfileChange(json.data);
    } catch (err: any) {
      setError(err?.message || "Failed to reset groups.");
    } finally {
      setSaving(false);
    }
  };

  // Live preview of group creation rules
  const groupCreationCheck = createMemo(() => {
    const p = profile();
    const raw = newGroupName().trim();
    if (!raw || !p) return null;
    return canCreateGroupNamespace(
      {
        sub: p.user?.sub || "anonymous",
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
          workflowId: createWorkflowId() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create group.");
      }
      const createdName = json.data?.group?.name || normalizeGroupName(newGroupName());
      setNewGroupName("");
      setNewGroupDesc("");
      setAssignGroup(createdName);
      setSuccessMsg(
        json.data?.runId
          ? `Created group "${createdName}" (granted ${createdName}:manager for this session) and triggered IdP workflow!`
          : `Created group "${createdName}" and granted "${createdName}:manager" for your current session.`
      );
      await loadAll();
      if (profile()) {
        emitProfileChange(profile()!);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to create group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const assignableGroups = createMemo(() => {
    const p = profile();
    if (!p) return [];
    return (p.allGrants || []).filter(
      (g) => g.rights.includes("manager") || g.rights.includes("use")
    );
  });

  const previewAssignClaim = createMemo(() => {
    const grp = normalizeGroupName(assignGroup() || "group1");
    if (rolePreset() === "manager") return `${grp}:manager`;
    if (rolePreset() === "use") return `${grp}:use`;
    return formatGroupClaim(grp, customRights());
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
    if (assigningMember()) return;
    setAssigningMember(true);
    setError("");
    setSuccessMsg("");
    try {
      const rightsPayload =
        rolePreset() === "manager"
          ? "manager"
          : rolePreset() === "use"
            ? "use"
            : customRights();

      const res = await fetch("/api/user/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_member",
          groupName: assignGroup(),
          targetUsername: targetUsername(),
          rights: rightsPayload,
          workflowId: assignWorkflowId(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to trigger IdP role assignment workflow.");
      }
      setSuccessMsg(
        `Triggered IdP workflow for user "${json.data.targetUsername}" with claim "${json.data.fullClaim}" (Run ID: ${json.data.runId}).`
      );
      setTargetUsername("");
    } catch (err: any) {
      setError(err?.message || "Failed to trigger workflow.");
    } finally {
      setAssigningMember(false);
    }
  };

  const createIdpWorkflowTemplate = async () => {
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const targetGrp = normalizeGroupName(assignGroup() || newGroupName() || "group1");
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Create Group & Assign Role in Keycloak / FerrisKey",
          description:
            "Template workflow triggered when creating a group or assigning a user role in the IdP. Uses {{ form.groupName }}, {{ form.targetUsername }}, {{ form.rights }}, and {{ form.fullClaim }}.",
          tags: targetGrp ? [targetGrp] : [],
          direction: "write",
          steps: [
            {
              id: "step_idp_group",
              name: "Sync Group / Role in IdP (Keycloak / FerrisKey)",
              type: "rest",
              direction: "write",
              url: "https://idp.example.com/admin/realms/master/groups",
              method: "POST",
              headers: '{"Content-Type": "application/json"}',
              body: JSON.stringify(
                {
                  action: "{{ form.action }}",
                  name: "{{ form.groupName }}",
                  parentGroup: "{{ form.parentGroup }}",
                  targetUsername: "{{ form.targetUsername }}",
                  rights: "{{ form.rights }}",
                  fullClaim: "{{ form.fullClaim }}",
                  requestedBy: "{{ form.actorUsername }}",
                },
                null,
                2
              ),
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to scaffold IdP workflow template.");
      }
      await loadAll();
      if (json.data?.id) {
        setCreateWorkflowId(json.data.id);
        setAssignWorkflowId(json.data.id);
      }
      setSuccessMsg(
        `Created template workflow "${json.data.name}"! You can select it below or customize its Connection in the Workflows editor.`
      );
    } catch (err: any) {
      setError(err?.message || "Failed to create template workflow.");
    } finally {
      setSaving(false);
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
                <Show when={profile()?.isAdmin}>
                  <Badge variant="success">Admin-Group Active</Badge>
                </Show>
              </div>
              <p class="text-xs text-zinc-400 truncate font-mono">
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
                title="Re-enable all your groups and personal ownership view"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>Reset All Groups</span>
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
              <span>My Groups & Perspective</span>
              <Badge variant="secondary" class="ml-1.5 px-1.5 py-0 text-[10px]">
                {profile()?.activeGrants?.length || 0}/{profile()?.allGrants?.length || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              active={activeTab() === "manage"}
              onClick={() => {
                setActiveTab("manage");
                setError("");
                setSuccessMsg("");
              }}
            >
              Create & Manage Groups (IdP)
            </TabsTrigger>
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
          fallback={<div class="py-12 text-center text-sm text-zinc-400">Loading your profile & group permissions...</div>}
        >
          {/* TAB 1: MY GROUPS & PERSPECTIVE */}
          <Show when={activeTab() === "groups"}>
            <div class="space-y-5">
              <div class="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 class="text-sm font-bold text-white">
                    Active Group Perspective & Permission Simulator
                  </h3>
                  <p class="mt-0.5 text-xs text-zinc-400">
                    Click any group to deactivate or activate it. Deactivated groups lose their highlight so you can inspect what another user with fewer groups sees.
                  </p>
                </div>
                <Show when={profile()?.isSimulating}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={saving()}
                    onClick={resetAllGroups}
                    class="shrink-0 border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 text-xs"
                  >
                    Reset All Groups
                  </Button>
                </Show>
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
                          Creator Default
                        </Badge>
                      </div>
                      <p class="text-xs text-zinc-400 mt-0.5">
                        View and manage all private/untagged resources you created. Turn off when testing another group's exact view.
                      </p>
                    </div>
                  </div>
                  <Badge variant={!profile()?.disableOwnerBypass ? "success" : "secondary"}>
                    {!profile()?.disableOwnerBypass ? "Active" : "Deactivated"}
                  </Badge>
                </div>
              </div>

              {/* Group Grants List */}
              <div class="space-y-2.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Your Groups ({profile()?.activeGrants?.length || 0} active of {profile()?.allGrants?.length || 0})
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
                      <p class="text-sm font-semibold text-zinc-300">No groups assigned yet</p>
                      <p class="mt-1 text-xs text-zinc-500">
                        Groups come from your IdP JWT (<code class="text-zinc-300">groups</code> claim), from tagging resources, or you can create a new group in the{" "}
                        <button
                          type="button"
                          onClick={() => setActiveTab("manage")}
                          class="text-purple-400 underline hover:text-purple-300"
                        >
                          Create & Manage Groups
                        </button>{" "}
                        tab.
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
                                  variant={
                                    grant.source === "jwt"
                                      ? "purple"
                                      : grant.source === "session"
                                        ? "amber"
                                        : "secondary"
                                  }
                                  class="text-[10px] px-2 py-0"
                                >
                                  {grant.source === "jwt"
                                    ? "IdP JWT"
                                    : grant.source === "session"
                                      ? "Session (Manager)"
                                      : "Tagged Resource"}
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
                              title={`Isolate "${grant.group}" — deactivate all other groups & @owner to see strictly what this group sees`}
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

          {/* TAB 2: CREATE & MANAGE GROUPS (IDP WORKFLOWS) */}
          <Show when={activeTab() === "manage"}>
            <div class="space-y-6">
              {/* Section 1: Create Group Namespace */}
              <form
                onSubmit={handleCreateGroup}
                class="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-5 space-y-4"
              >
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 class="text-base font-bold text-white">Create Group Namespace</h3>
                    <p class="mt-0.5 text-xs text-zinc-400">
                      Create a root group (e.g. <code class="text-purple-300">group1</code>) if it does not exist yet, or a sub-group (e.g. <code class="text-purple-300">group1.test1</code>) if you have <code class="text-amber-300">group1:manager</code>.
                    </p>
                  </div>
                  <Badge variant="amber" class="text-[10px]">
                    Grants Session group:manager
                  </Badge>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="block text-xs font-semibold text-zinc-300">
                      Group Namespace (use "." for hierarchy)
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
                              ✓ Valid {chk().parent ? `sub-group under "${chk().parent}"` : "root group"} — will grant{" "}
                              <strong>{chk().normalized}:manager</strong> for this session
                            </span>
                          </Show>
                        </div>
                      )}
                    </Show>
                  </div>

                  <div class="space-y-1.5">
                    <label class="block text-xs font-semibold text-zinc-300">
                      Trigger IdP Workflow on Creation (Optional)
                    </label>
                    <select
                      value={createWorkflowId()}
                      onChange={(e) => setCreateWorkflowId(e.currentTarget.value)}
                      class="w-full h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">— None (Session / Local Only) —</option>
                      <For each={workflows()}>
                        {(wf) => <option value={wf.id}>{wf.name || wf.id}</option>}
                      </For>
                    </select>
                    <p class="text-[11px] text-zinc-500">
                      Passes <code class="text-zinc-300">{"{{ form.groupName }}"}</code>, <code class="text-zinc-300">{"{{ form.parentGroup }}"}</code>, <code class="text-zinc-300">{"{{ form.creatorUsername }}"}</code>.
                    </p>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={createIdpWorkflowTemplate}
                    disabled={saving()}
                    class="text-xs font-semibold text-purple-400 hover:text-purple-300 underline"
                  >
                    + Generate "Create Group in Keycloak / FerrisKey" Workflow Template
                  </button>
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
                    {creatingGroup() ? "Creating..." : "Create Group"}
                  </Button>
                </div>
              </form>

              {/* Section 2: Assign User to Group Role via IdP Workflow (Zero User Discovery) */}
              <form
                onSubmit={handleAssignMember}
                class="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-5 space-y-4"
              >
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 class="text-base font-bold text-white">
                      Assign User Role in IdP (Keycloak / FerrisKey Workflow)
                    </h3>
                    <p class="mt-0.5 text-xs text-zinc-400">
                      Trigger an automated workflow to grant a user permissions in your IdP. Requires <code class="text-amber-300">:manager</code> or <code class="text-emerald-300">:use</code> on the group.
                    </p>
                  </div>
                  <Badge variant="secondary" class="text-[10px]">
                    No User Discovery (Exact Username)
                  </Badge>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="block text-xs font-semibold text-zinc-300">
                      Target Group
                    </label>
                    <select
                      value={assignGroup()}
                      onChange={(e) => setAssignGroup(e.currentTarget.value)}
                      class="w-full h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 font-mono text-xs text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Select a group...</option>
                      <For each={assignableGroups()}>
                        {(g) => (
                          <option value={g.group}>
                            {g.group} ({g.rights.includes("manager") ? "manager" : "use"})
                          </option>
                        )}
                      </For>
                    </select>
                  </div>

                  <div class="space-y-1.5">
                    <label class="block text-xs font-semibold text-zinc-300">
                      Exact Target Username (No User Lookup)
                    </label>
                    <Input
                      value={targetUsername()}
                      onInput={(e) => setTargetUsername(e.currentTarget.value)}
                      placeholder="Enter exact IdP username (e.g. user1)"
                      autocomplete="off"
                      spellcheck={false}
                      class="font-mono"
                    />
                  </div>
                </div>

                {/* Role / Rights Builder */}
                <div class="space-y-2">
                  <label class="block text-xs font-semibold text-zinc-300">
                    Role / Rights Claim to Assign
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
                      :manager (Full + Sub-groups)
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
                      :use (View & Execute)
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
                      <For each={["view", "use", "write", "delete"] as GroupRight[]}>
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
                    <span class="text-zinc-400">Resulting JWT Claim:</span>
                    <code class="font-mono font-bold text-purple-300">{previewAssignClaim()}</code>
                  </div>
                </div>

                {/* Workflow to Execute */}
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-zinc-300">
                    IdP Management Workflow to Execute
                  </label>
                  <select
                    value={assignWorkflowId()}
                    onChange={(e) => setAssignWorkflowId(e.currentTarget.value)}
                    class="w-full h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Select workflow...</option>
                    <For each={workflows()}>
                      {(wf) => <option value={wf.id}>{wf.name || wf.id}</option>}
                    </For>
                  </select>
                </div>

                <div class="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={
                      assigningMember() ||
                      !assignGroup() ||
                      !targetUsername().trim() ||
                      !assignWorkflowId()
                    }
                  >
                    {assigningMember() ? "Running Workflow..." : "Run IdP Assignment Workflow"}
                  </Button>
                </div>
              </form>
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
        </Show>
      </div>
    </dialog>
  );
}
