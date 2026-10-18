import { createSignal, createResource, onMount, onCleanup, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { ResourceTagEditor } from "~/components/ResourceTagEditor";

interface DatabaseInfo {
  names: string[];
  meta: Array<{
    name: string;
    owner?: string;
    tags: string[];
    permissions?: {
      canView: boolean;
      canUse: boolean;
      canWrite: boolean;
      canDelete: boolean;
    };
  }>;
}

export default function DatabaseOverview() {
  const [newDbName, setNewDbName] = createSignal("");
  const [newDbTags, setNewDbTags] = createSignal<string[]>([]);
  const [isCreating, setIsCreating] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal("");

  const fetchDatabases = async (): Promise<DatabaseInfo> => {
    try {
      const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/database` : "/api/database";
      const res = await fetch(url);
      const text = await res.text();
      const json = JSON.parse(text);
      return json.success
        ? {
            names: Array.isArray(json.data) ? json.data : [],
            meta: Array.isArray(json.meta) ? json.meta : [],
          }
        : { names: [], meta: [] };
    } catch (e: any) {
      console.error("Database fetch failed:", e);
      return { names: [], meta: [] };
    }
  };

  const [dbInfo, { refetch }] = createResource(fetchDatabases);
  const databases = () => dbInfo()?.names || [];
  const getDbMeta = (dbName: string) => dbInfo()?.meta?.find((m) => m.name === dbName);

  onMount(() => {
    refetch();
    const onGroupsChanged = () => refetch();
    window.addEventListener("user-groups-changed", onGroupsChanged);
    onCleanup(() => window.removeEventListener("user-groups-changed", onGroupsChanged));
  });

  const handleCreate = async () => {
    const name = newDbName().trim();
    if (!name) return;
    
    setIsCreating(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tags: newDbTags() }),
      });
      const json = await res.json();
      if (json.success) {
        setNewDbName("");
        setNewDbTags([]);
        window.dispatchEvent(new CustomEvent("user-groups-changed"));
        refetch();
      } else {
        setErrorMsg(json.error || "Failed to create database");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const updateDbTags = async (dbName: string, nextTags: string[]) => {
    try {
      const res = await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_meta", name: dbName, tags: nextTags }),
      });
      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent("user-groups-changed"));
        refetch();
      } else {
        alert(json.error || "Failed to update database group tags");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <main class="mx-auto max-w-5xl 2xl:max-w-7xl px-4 sm:px-6 py-12 text-white">
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-3xl font-extrabold tracking-tight">Database Management</h1>
      </div>

      <div class="mb-10 rounded-xl border border-[#2a2a3a] bg-[#1e1e2e] p-6 shadow-lg relative">
        <h2 class="mb-4 text-lg font-bold text-white flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12H3"></path><path d="M21 6H3"></path><path d="M21 18H3"></path></svg>
          Create New Database
        </h2>
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-4">
            <input
              type="text"
              class="flex-1 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-3 text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-[#5b5b6e]"
              placeholder="e.g. analytics_db"
              value={newDbName()}
              onInput={(e) => setNewDbName(e.currentTarget.value)}
              disabled={isCreating()}
            />
            <button
              onClick={handleCreate}
              disabled={isCreating() || !newDbName().trim()}
              class="btn-primary min-w-[120px] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Show when={isCreating()} fallback="Create">
                <svg class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Creating...
              </Show>
            </button>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Group Tags (Optional — share database with groups)</label>
            <ResourceTagEditor tags={newDbTags()} onChange={setNewDbTags} />
          </div>
        </div>
        <Show when={errorMsg()}>
          <p class="mt-2 text-sm text-red-500">{errorMsg()}</p>
        </Show>
      </div>

      <div>
        <h2 class="mb-4 text-xl font-bold flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
          Available Databases
        </h2>
        <Show when={dbInfo.loading}>
          <div class="flex justify-center p-8">
            <svg class="animate-spin h-8 w-8 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
        </Show>
        <Show when={!dbInfo.loading && databases().length === 0}>
          <div class="rounded-xl border border-dashed border-[#2a2a3a] py-16 text-center bg-[#0a0a0f]/50">
            <p class="text-[#8b8b9e]">No databases found in the current namespace.</p>
          </div>
        </Show>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <For each={databases()}>
            {(db) => {
              const meta = () => getDbMeta(db);
              return (
                <div class="card p-6 border-t-4 border-t-blue-500 hover:-translate-y-1 transition-transform group flex flex-col justify-between gap-4">
                  <a href={`/database/${db}`} target="_self" class="block">
                    <div class="flex items-center justify-between mb-2">
                      <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{db}</h3>
                      <svg class="text-[#8b8b9e] group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                    <p class="text-sm text-[#5b5b6e]">Click to view tables and data</p>
                  </a>
                  <div class="pt-3 border-t border-[#2a2a3a]/60" onClick={(e) => e.stopPropagation()}>
                    <ResourceTagEditor
                      tags={meta()?.tags || []}
                      onChange={(nextTags) => updateDbTags(db, nextTags)}
                      readOnly={meta()?.permissions?.canWrite === false}
                      compact
                    />
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </main>
  );
}
