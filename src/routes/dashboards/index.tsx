import { createMemo, createResource, createSignal, For, Show, Suspense } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { isServer } from "solid-js/web";

type DashboardSummary = {
  id: string;
  name?: string;
  isPublic?: boolean;
  buttons?: unknown[];
  updated_at?: string;
  created_at?: string;
};

const dashboardId = (id: string) => id.replace("dashboard:", "");

const formatDate = (value?: string) => {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export default function Dashboards() {
  const navigate = useNavigate();
  const [query, setQuery] = createSignal("");
  const [error, setError] = createSignal("");
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const [dashboards, { refetch }] = createResource<DashboardSummary[]>(() => query(), async (q) => {
    setError("");
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const url = isServer
        ? `http://127.0.0.1:${process.env.PORT || 3000}/api/dashboards${params}`
        : `/api/dashboards${params}`;
      const res = await fetch(url);
      const text = await res.text();
      const json = JSON.parse(text);
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Unable to load dashboards");
      }
      return json.success ? json.data : [];
    } catch (e: any) {
      console.error("Dashboards fetch failed:", e);
      setError(e?.message || "Unable to load dashboards");
      return [];
    }
  });

  const handleSearch = (value: string) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => setQuery(value), 300);
  };

  const visibleDashboards = createMemo(() => {
    const items = dashboards() || [];
    return [...items].sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });
  });

  const publicCount = createMemo(() => (dashboards() || []).filter((dashboard) => dashboard.isPublic).length);
  const widgetCount = createMemo(() =>
    (dashboards() || []).reduce((total, dashboard) => total + (dashboard.buttons?.length || 0), 0)
  );

  const deleteDashboard = async (id: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this dashboard? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/dashboards/${dashboardId(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        refetch();
      } else {
        alert(json.error || "Failed to delete dashboard");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <section class="mb-8 overflow-hidden rounded-2xl border border-[#1e1e2e] bg-[#12121a]/80 shadow-2xl shadow-black/20">
        <div class="flex flex-col gap-6 border-b border-[#1e1e2e] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              <span class="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
              Workflow control surfaces
            </div>
            <h1 class="text-3xl font-extrabold tracking-tight text-white">Dashboards</h1>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-[#8b8b9e]">
              Build public or internal boards that turn workflows into buttons, forms, charts, and tables.
            </p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => refetch()}
              class="btn-secondary justify-center"
              disabled={dashboards.loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"></path><path d="M3 21v-5h5"></path><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"></path><path d="M21 3v5h-5"></path></svg>
              Refresh
            </button>
            <a href="/dashboards/new" target="_self" class="btn-primary justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              New Dashboard
            </a>
          </div>
        </div>

        <div class="grid grid-cols-1 divide-y divide-[#1e1e2e] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div class="p-5">
            <div class="text-xs font-semibold uppercase tracking-wide text-[#5a5a6e]">Total</div>
            <div class="mt-2 text-2xl font-bold text-white">{dashboards()?.length || 0}</div>
          </div>
          <div class="p-5">
            <div class="text-xs font-semibold uppercase tracking-wide text-[#5a5a6e]">Published</div>
            <div class="mt-2 text-2xl font-bold text-emerald-300">{publicCount()}</div>
          </div>
          <div class="p-5">
            <div class="text-xs font-semibold uppercase tracking-wide text-[#5a5a6e]">Widgets</div>
            <div class="mt-2 text-2xl font-bold text-blue-300">{widgetCount()}</div>
          </div>
        </div>
      </section>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="relative w-full sm:max-w-md">
          <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a6e]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
          <input
            onInput={(e) => handleSearch(e.currentTarget.value)}
            class="w-full rounded-xl border border-[#1e1e2e] bg-[#12121a] py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#5a5a6e] focus:border-blue-500"
            placeholder="Search dashboards"
          />
        </div>
        <div class="text-sm text-[#8b8b9e]">
          <Show when={!dashboards.loading} fallback="Loading dashboards...">
            Showing {visibleDashboards().length} of {dashboards()?.length || 0}
          </Show>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Suspense fallback={<div class="col-span-full rounded-2xl border border-[#1e1e2e] bg-[#12121a] py-12 text-center text-[#8b8b9e]">Loading dashboards...</div>}>
          <Show when={error()}>
            <div class="col-span-full rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error()}
            </div>
          </Show>

          <Show when={!dashboards.loading && dashboards()?.length === 0 && !error()}>
            <div class="col-span-full rounded-2xl border border-dashed border-[#2a2a3a] bg-[#0a0a0f]/50 px-6 py-16 text-center">
              <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
              </div>
              <h3 class="mb-2 text-lg font-bold text-white">No dashboards yet</h3>
              <p class="mx-auto mb-6 max-w-md text-sm leading-6 text-[#8b8b9e]">Create a dashboard to securely expose your workflows as reusable controls for teammates or external users.</p>
              <a href="/dashboards/new" target="_self" class="btn-primary">Create Dashboard</a>
            </div>
          </Show>

          <Show when={!dashboards.loading && dashboards()?.length !== 0 && visibleDashboards().length === 0}>
            <div class="col-span-full rounded-2xl border border-dashed border-[#2a2a3a] bg-[#0a0a0f]/50 px-6 py-12 text-center">
              <h3 class="mb-2 font-bold text-white">No matching dashboards</h3>
              <p class="text-sm text-[#8b8b9e]">Try a different search term.</p>
            </div>
          </Show>

          <For each={visibleDashboards()}>
            {(d) => (
              <div 
                onClick={() => navigate(`/dashboards/${dashboardId(d.id)}`)}
                class="card group flex h-full cursor-pointer flex-col overflow-hidden border-l-4 border-l-blue-500 p-0"
              >
                <div class="flex items-start justify-between gap-4 p-5">
                  <div class="min-w-0">
                    <h3 class="truncate text-lg font-bold text-white transition-colors group-hover:text-blue-300">
                      {d.name || "Untitled Dashboard"}
                    </h3>
                    <p class="mt-1 text-xs text-[#8b8b9e]">
                      Updated {formatDate(d.updated_at || d.created_at)}
                    </p>
                  </div>
                  <span class={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    d.isPublic
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border-[#2a2a3a] bg-[#0a0a0f] text-[#8b8b9e]"
                  }`}>
                    {d.isPublic ? "Public" : "Private"}
                  </span>
                </div>
                
                <div class="mx-5 mb-5 grid grid-cols-2 gap-3">
                  <div class="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f]/60 p-3">
                    <div class="text-[10px] font-semibold uppercase tracking-wide text-[#5a5a6e]">Widgets</div>
                    <div class="mt-1 text-xl font-bold text-white">{d.buttons?.length || 0}</div>
                  </div>
                  <div class="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f]/60 p-3">
                    <div class="text-[10px] font-semibold uppercase tracking-wide text-[#5a5a6e]">Access</div>
                    <div class="mt-1 truncate text-sm font-semibold text-white">{d.isPublic ? "Shared" : "Internal"}</div>
                  </div>
                </div>
                
                <div class="mt-auto flex items-center justify-between border-t border-[#2a2a3a] bg-[#0f0f16]/70 px-5 py-3">
                  <span class="text-xs font-medium text-[#8b8b9e] group-hover:text-white">Open editor</span>
                  <div class="flex items-center gap-2">
                    <Show when={d.isPublic}>
                      <a 
                        href={`/p/${dashboardId(d.id)}`} 
                        target="_blank" 
                        onClick={(e: Event) => e.stopPropagation()} 
                        class="rounded-lg p-2 text-[#8b8b9e] transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                        title="View Public Board"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </Show>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDashboard(d.id, e);
                      }} 
                      class="rounded-lg p-2 text-[#8b8b9e] transition-colors hover:bg-red-500/10 hover:text-red-300"
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </Suspense>
      </div>
    </main>
  );
}
