import { createMemo, createResource, createSignal, onMount, For, Show, Suspense } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { isServer } from "solid-js/web";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type DashboardSummary = {
  id: string;
  name?: string;
  isPublic?: boolean;
  buttons?: unknown[];
  updated_at?: string;
  created_at?: string;
  description?: string;
  tags?: string[];
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

  const [dashboards, { refetch }] = createResource<DashboardSummary[], string>(() => query(), async (q) => {
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
      if (!isServer) {
        setError(e?.message || "Unable to load dashboards");
      }
      return [];
    }
  });

  onMount(() => {
    refetch();
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
    <main class="mx-auto max-w-7xl 2xl:max-w-[90rem] px-4 py-8 sm:px-6 lg:py-10">
      <Card class="mb-8 overflow-hidden bg-zinc-950/80 border-zinc-800/80">
        <div class="flex flex-col gap-6 border-b border-zinc-800/80 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="mb-2">
              <Badge variant="blue" class="gap-1.5">
                <span class="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                Workflow control surfaces
              </Badge>
            </div>
            <h1 class="text-4xl font-extrabold tracking-tight text-white">Dashboards</h1>
            <p class="mt-2 max-w-2xl text-base leading-6 text-zinc-400">
              Build public or internal boards that turn workflows into buttons, forms, charts, and tables.
            </p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <a href="/library">
              <Button variant="secondary" size="sm" class="w-full justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                Library
              </Button>
            </a>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={dashboards.loading}
              class="justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"></path><path d="M3 21v-5h5"></path><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"></path><path d="M21 3v5h-5"></path></svg>
              Refresh
            </Button>
            <a href="/dashboards/new" target="_self">
              <Button variant="primary" size="sm" class="w-full justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                New Dashboard
              </Button>
            </a>
          </div>
        </div>

        <div class="grid grid-cols-1 divide-y divide-zinc-800/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0 bg-zinc-950/40">
          <div class="p-5">
            <div class="text-sm font-semibold uppercase tracking-wide text-zinc-500">Total</div>
            <div class="mt-2 text-3xl font-bold text-white">{dashboards()?.length || 0}</div>
          </div>
          <div class="p-5">
            <div class="text-sm font-semibold uppercase tracking-wide text-zinc-500">Published</div>
            <div class="mt-2 text-3xl font-bold text-emerald-300">{publicCount()}</div>
          </div>
          <div class="p-5">
            <div class="text-sm font-semibold uppercase tracking-wide text-zinc-500">Widgets</div>
            <div class="mt-2 text-3xl font-bold text-blue-300">{widgetCount()}</div>
          </div>
        </div>
      </Card>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="relative w-full sm:max-w-md">
          <svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
          <Input
            onInput={(e) => handleSearch(e.currentTarget.value)}
            class="pl-10"
            placeholder="Search dashboards..."
          />
        </div>
        <div class="text-sm text-zinc-400">
          <Show when={!dashboards.loading} fallback="Loading dashboards...">
            Showing {visibleDashboards().length} of {dashboards()?.length || 0}
          </Show>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Suspense fallback={<div class="col-span-full rounded-2xl border border-zinc-800 bg-zinc-950/60 py-12 text-center text-zinc-400">Loading dashboards...</div>}>
          <Show when={error()}>
            <div class="col-span-full rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200 flex items-center justify-between shadow-lg">
              <div class="flex items-center gap-3">
                <span class="text-2xl">⚠️</span>
                <div>
                  <div class="font-bold text-white">Database Connection Error</div>
                  <div class="text-xs text-rose-300/90 font-mono mt-0.5">{error()}</div>
                  <div class="text-[11px] text-zinc-400 mt-1">
                    Please check your <code class="text-rose-300">SURREALDB_URL</code> in <code class="text-zinc-300">.env</code>.
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => refetch()}
                class="bg-rose-600/30 hover:bg-rose-600/50 text-rose-100 border border-rose-500/40 shrink-0"
              >
                Retry
              </Button>
            </div>
          </Show>

          <Show when={!dashboards.loading && dashboards()?.length === 0 && !error()}>
            <div class="col-span-full rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-16 text-center">
              <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300 border border-blue-500/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
              </div>
              <h3 class="mb-2 text-lg font-bold text-white tracking-tight">No dashboards yet</h3>
              <p class="mx-auto mb-6 max-w-md text-sm leading-6 text-zinc-400">Create a dashboard to securely expose your workflows as reusable controls for teammates or external users.</p>
              <a href="/dashboards/new" target="_self">
                <Button variant="primary">Create Dashboard</Button>
              </a>
            </div>
          </Show>

          <Show when={!dashboards.loading && dashboards()?.length !== 0 && visibleDashboards().length === 0}>
            <div class="col-span-full rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-12 text-center">
              <h3 class="mb-2 font-bold text-white">No matching dashboards</h3>
              <p class="text-sm text-zinc-400">Try a different search term.</p>
            </div>
          </Show>

          <For each={visibleDashboards()}>
            {(d) => (
              <Card 
                onClick={() => navigate(`/dashboards/${dashboardId(d.id)}`)}
                class="group flex h-full cursor-pointer flex-col overflow-hidden border-l-4 border-l-blue-500 hover:border-blue-500/50 hover:bg-zinc-900/60 transition-all duration-200"
              >
                <CardHeader class="p-5 pb-3">
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <CardTitle class="truncate text-lg font-bold text-white transition-colors group-hover:text-blue-300">
                        {d.name || "Untitled Dashboard"}
                      </CardTitle>
                      <CardDescription class="mt-1">
                        Updated {formatDate(d.updated_at || d.created_at)}
                      </CardDescription>
                    </div>
                    <Badge variant={d.isPublic ? "success" : "secondary"} class="shrink-0">
                      {d.isPublic ? "Public" : "Private"}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent class="px-5 pb-4">
                  <Show when={d.description}>
                    <p class="text-sm text-zinc-400 line-clamp-2 mb-3">{d.description}</p>
                  </Show>
                  <Show when={d.tags && d.tags.length > 0}>
                    <div class="flex flex-wrap gap-1.5 mb-3">
                      <For each={d.tags}>
                        {(tag) => <Badge variant="purple">{tag}</Badge>}
                      </For>
                    </div>
                  </Show>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
                      <div class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Widgets</div>
                      <div class="mt-1 text-xl font-bold text-white">{d.buttons?.length || 0}</div>
                    </div>
                    <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
                      <div class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Access</div>
                      <div class="mt-1 truncate text-sm font-semibold text-white">{d.isPublic ? "Shared" : "Internal"}</div>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter class="mt-auto flex items-center justify-between border-t border-zinc-800/80 bg-zinc-950/60 px-5 py-3">
                  <span class="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Open editor</span>
                  <div class="flex items-center gap-2">
                    <Show when={d.isPublic}>
                      <a 
                        href={`/p/${dashboardId(d.id)}`} 
                        target="_blank" 
                        onClick={(e: Event) => e.stopPropagation()} 
                        class="rounded-lg px-2.5 py-1 text-xs text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300 flex items-center gap-1 border border-blue-500/20"
                        title="Public View"
                      >
                        <span>Public View</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </Show>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDashboard(d.id, e);
                      }} 
                      class="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      title="Delete"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </CardFooter>
              </Card>
            )}
          </For>
        </Suspense>
      </div>
    </main>
  );
}
