import { createSignal, createResource, createMemo, onMount, onCleanup, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { A } from "@solidjs/router";

import { checkWorkflowConfiguredInDashboards, getWorkflowDashboardUsage } from "~/lib/workflowVariableChecker";
import { GroupTagPicker } from "~/components/GroupTagPicker";
import VoteControl from "~/components/VoteControl";
import { compareByVotes } from "~/lib/votes";

export default function Workflows() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [isDeleting, setIsDeleting] = createSignal<string | null>(null);
  const [isCloning, setIsCloning] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [noAccess, setNoAccess] = createSignal<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const [dashboards, { refetch: refetchDashboards }] = createResource(async () => {
    try {
      const url = isServer
        ? `http://127.0.0.1:${process.env.PORT || 3000}/api/dashboards`
        : "/api/dashboards";
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });


  const fetchWorkflows = async (q: string) => {
    setError(null);
    setNoAccess(null);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const url = isServer
        ? `http://127.0.0.1:${process.env.PORT || 3000}/api/workflows${params}`
        : `/api/workflows${params}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (res.status === 403) {
        if (!isServer) {
          setNoAccess(json.error || "Creator or Admin role is required to view workflows.");
        }
        return [];
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to load workflows (${res.status})`);
      }
      return Array.isArray(json.data) ? json.data : [];
    } catch (e: any) {
      console.error("fetchWorkflows error:", e);
      if (!isServer) {
        setError(e?.message || "Failed to load workflows from SurrealDB");
      }
      return [];
    }
  };

  const [workflows, { refetch, mutate }] = createResource(() => searchQuery(), fetchWorkflows);

  onMount(() => {
    // Only refetch if SSR did not already populate the resource
    if (!workflows.loading && (!workflows() || workflows()?.length === 0)) {
      refetch();
    }
    if (!dashboards.loading && (!dashboards() || dashboards()?.length === 0)) {
      refetchDashboards();
    }
    const onGroupsChanged = () => {
      refetch();
      refetchDashboards();
    };
    window.addEventListener("user-groups-changed", onGroupsChanged);
    onCleanup(() => {
      window.removeEventListener("user-groups-changed", onGroupsChanged);
    });
  });

  const [sortBy, setSortBy] = createSignal<"updated" | "top">("updated");

  const sortedWorkflows = createMemo(() => {
    const list = [...(workflows() || [])];
    if (sortBy() === "top") {
      return list.sort(compareByVotes);
    }
    return list.sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });
  });

  const handleSearch = (value: string) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => setSearchQuery(value), 300);
  };

  const deleteWorkflow = async (workflow: any, e: Event) => {
    e.preventDefault();
    const id = typeof workflow?.id === "string" ? workflow.id : String(workflow?.id || "");
    const usage = getWorkflowDashboardUsage(workflow, dashboards() || []);
    let confirmMsg = `Are you sure you want to delete workflow "${workflow.name || "Untitled"}"?`;
    if (usage.count > 0) {
      confirmMsg = `⚠️ WARNING: This workflow is actively configured in ${usage.count} dashboard(s):\n• ${usage.dashboardNames.join("\n• ")}\n\nDeleting it may break these dashboards. Are you sure you want to proceed?`;
    }
    if (!confirm(confirmMsg)) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/workflows/${id.split(":")[1] || id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        alert(json.error || "Failed to delete workflow");
      } else {
        refetch();
      }
    } finally {
      setIsDeleting(null);
    }
  };

  const cloneWorkflow = async (workflowId: string, currentName: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCloning()) return;

    const rawId = workflowId.includes(":") ? workflowId.split(":")[1] : workflowId;
    const cleanId = rawId.replace(/[⟨⟩]/g, "");

    const defaultCloneName = `${currentName || "Workflow"} (Copy)`;
    const cloneName = prompt("Enter a name for the cloned workflow:", defaultCloneName);
    if (!cloneName || !cloneName.trim()) return;

    setIsCloning(workflowId);
    try {
      const res = await fetch(`/api/workflows/${cleanId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cloneName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        const newRawId = String(json.data.id || "");
        const newCleanId = newRawId.includes(":")
          ? newRawId.split(":")[1].replace(/[⟨⟩]/g, "")
          : newRawId.replace(/[⟨⟩]/g, "");
        window.location.href = `/workflows/${newCleanId}`;
      } else {
        alert(`Failed to clone workflow: ${json.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Failed to clone workflow: ${err.message || String(err)}`);
    } finally {
      setIsCloning(null);
    }
  };

  return (
    <main class="mx-auto max-w-7xl 2xl:max-w-[90rem] px-4 sm:px-6 py-12">
      <div class="mb-10 flex items-end justify-between">
        <div>
          <h1 class="text-5xl font-extrabold tracking-tight text-white mb-2">Workflows</h1>
          <p class="text-base text-[#8b8b9e]">Build, chain, and automate gRPC requests</p>
        </div>
        
        <A href="/workflows/new" class="btn-primary hover-lift glow-effect group flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="transition-transform group-hover:scale-110" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Workflow
        </A>
      </div>

      {/* Search */}
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="relative w-full sm:max-w-md">
          <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a6e]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
          <input
            onInput={(e) => handleSearch(e.currentTarget.value)}
            class="w-full rounded-xl border border-[#1e1e2e] bg-[#12121a] py-3 pl-10 pr-4 text-base text-white outline-none transition-colors placeholder:text-[#5a5a6e] focus:border-blue-500"
            placeholder="Search workflows..."
          />
        </div>
        <div class="flex items-center gap-3">
          <label class="text-xs text-[#8b8b9e] shrink-0">Sort by:</label>
          <select
            value={sortBy()}
            onChange={(e) => setSortBy(e.currentTarget.value as any)}
            class="rounded-xl border border-[#1e1e2e] bg-[#12121a] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors"
          >
            <option value="updated">Recently Updated</option>
            <option value="top">Top Voted</option>
          </select>
          <div class="text-base text-[#8b8b9e]">
            <Show when={!workflows.loading} fallback="Searching...">
              {workflows()?.length || 0} workflow{(workflows()?.length || 0) !== 1 ? "s" : ""}
            </Show>
          </div>
        </div>
      </div>

      {/* Restricted access notice for user / viewer roles */}
      <Show when={noAccess()}>
        <div class="mb-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-8 text-center">
          <h3 class="text-lg font-bold text-amber-200 mb-1">Workflows Require Creator or Admin Role</h3>
          <p class="text-sm text-zinc-400">{noAccess()}</p>
        </div>
      </Show>

      {/* Error state with retry */}
      <Show when={error()}>
        <div class="mb-6 p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 flex items-center justify-between shadow-lg">
          <div class="flex items-center gap-3">
            <span class="text-2xl">⚠️</span>
            <div>
              <div class="font-bold text-sm text-white">Database Connection Error</div>
              <div class="text-xs text-rose-300/90 font-mono mt-0.5">{error()}</div>
              <div class="text-[11px] text-[#8b8b9e] mt-1">
                Please check your <code class="text-rose-300">SURREALDB_URL</code> in <code class="text-zinc-300">.env</code>.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            class="px-3.5 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-100 border border-rose-500/40 text-xs font-semibold transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      </Show>

      <Show
        when={workflows() && workflows().length > 0}
        fallback={
          <Show when={!error() && !noAccess()}>
            <div class="card flex flex-col items-center justify-center p-16 text-center border-dashed border-[#2a2a3a]">
              <div class="mb-6 rounded-full bg-[#1e1e2e] p-6 text-[#5b5b6e]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
              <h3 class="mb-2 text-xl font-bold text-white">
                {searchQuery() ? "No matching workflows" : "No workflows found"}
              </h3>
              <p class="mb-6 max-w-md text-[#8b8b9e]">
                {searchQuery()
                  ? "Try a different search term."
                  : "You haven't created any automated gRPC workflows yet. Start building your first flow!"}
              </p>
              <Show when={!searchQuery()}>
                <A href="/workflows/new" class="btn-primary">Create Your First Workflow</A>
              </Show>
            </div>
          </Show>
        }
      >
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <For each={sortedWorkflows()}>
            {(workflow: any) => {
              const vStatus = createMemo(() => checkWorkflowConfiguredInDashboards(workflow, dashboards() || []));
              const usage = createMemo(() => getWorkflowDashboardUsage(workflow, dashboards() || []));
              const rawWfId = () => {
                const idStr = typeof workflow?.id === "string" ? workflow.id : String(workflow?.id || "");
                return idStr.includes(":") ? idStr.split(":")[1] : idStr;
              };
              return (
                <A href={`/workflows/${rawWfId()}`} class="card group relative flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 overflow-hidden">
                  {/* Translucent top color: light red on top when workflow has variables and unconfigured in dashboard, light green when all configured */}
                  <Show when={vStatus().hasVariables}>
                    <div
                      class={`absolute top-0 left-0 right-0 h-12 rounded-t-2xl pointer-events-none transition-colors border-b ${
                        vStatus().allConfigured
                          ? "bg-emerald-500/20 border-emerald-500/30"
                          : "bg-red-500/20 border-red-500/30"
                      }`}
                    />
                  </Show>

                  <div>
                    <div class="mb-4 flex items-center justify-between relative z-10">
                      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                      </div>
                      
                      <div class="flex items-center gap-2">
                        <Show when={vStatus().hasVariables}>
                          <span class={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm ${
                            vStatus().allConfigured
                              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                              : "border-red-500/40 bg-red-500/20 text-red-300"
                          }`}>
                            {vStatus().allConfigured ? "✓ Vars Configured" : "⚠️ Vars Unconfigured"}
                          </span>
                        </Show>

                        {/* Dashboard configuration counter */}
                        <Show
                          when={usage().count > 0}
                          fallback={
                            <span
                              class="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-300 backdrop-blur-sm"
                              title="Not configured in any dashboard. Can be safely deleted."
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              <span>0 Dashboards • Safe to delete</span>
                            </span>
                          }
                        >
                          <span
                            class="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300 backdrop-blur-sm"
                            title={`Configured in ${usage().count} dashboard(s): ${usage().dashboardNames.join(", ")}`}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
                              <rect x="3" y="3" width="7" height="7"></rect>
                              <rect x="14" y="3" width="7" height="7"></rect>
                              <rect x="14" y="14" width="7" height="7"></rect>
                              <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                            <span>{usage().count} {usage().count === 1 ? "Dashboard" : "Dashboards"}</span>
                          </span>
                        </Show>

                        <VoteControl
                          endpoint={`/api/workflows/${rawWfId()}/vote`}
                          votes={workflow.votes}
                          onChange={(newVotes) => {
                            mutate((prev: any[] | undefined) =>
                              (prev || []).map((w) =>
                                (w.id === workflow.id || rawWfId() === (w.id?.includes(":") ? w.id.split(":")[1] : w.id))
                                  ? { ...w, votes: newVotes }
                                  : w
                              )
                            );
                          }}
                        />

                        <GroupTagPicker
                          tags={workflow.tags || []}
                          endpoint={`/api/workflows/${rawWfId()}`}
                          canEdit={workflow.permissions?.canWrite !== false}
                          onUpdated={(nextTags, nextPerms) => {
                            mutate((prev: any[] | undefined) =>
                              (prev || []).map((w) =>
                                w.id === workflow.id
                                  ? {
                                      ...w,
                                      tags: nextTags,
                                      permissions: nextPerms || w.permissions,
                                    }
                                  : w
                              )
                            );
                          }}
                        />
                        <button
                          type="button"
                          class="text-[#5b5b6e] transition-colors hover:text-blue-400 p-1 rounded hover:bg-blue-500/10"
                          onClick={(e) => cloneWorkflow(workflow.id, workflow.name, e)}
                          disabled={isCloning() === workflow.id}
                          title="Clone Workflow"
                        >
                          <Show
                            when={isCloning() === workflow.id}
                            fallback={
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            }
                          >
                            <svg class="animate-spin h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </Show>
                        </button>
                        <Show when={workflow.permissions?.canDelete !== false}>
                          <button 
                            class="text-[#5b5b6e] transition-colors hover:text-red-400"
                            onClick={(e) => deleteWorkflow(workflow, e)}
                            disabled={isDeleting() === workflow.id}
                            title="Delete Workflow"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M3 6h18"></path>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                          </button>
                        </Show>
                      </div>
                    </div>

                  
                  <h3 class="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">{workflow.name || "Untitled Workflow"}</h3>
                  <p class="mt-2 text-sm text-[#8b8b9e] line-clamp-2">
                    {workflow.steps?.length || 0} steps connected to {workflow.serverAddress}
                  </p>
                </div>
                
                <div class="mt-6 flex items-center justify-between border-t border-[#1e1e2e] pt-4 text-xs text-[#5b5b6e]">
                  <span>Last updated: {new Date(workflow.updated_at || Date.now()).toISOString().split('T')[0]}</span>
                  <span class="flex items-center gap-1 group-hover:text-white transition-colors">
                    Edit Flow
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </span>
                </div>
              </A>
            )}}
          </For>
        </div>
      </Show>
    </main>
  );
}
