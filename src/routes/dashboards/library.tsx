import { createSignal, createMemo, createResource, For, Show, Suspense, onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { isServer } from "solid-js/web";
import DashboardGrid, { getDefaultWidgetDimensions } from "~/components/dashboard/DashboardGrid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type DashboardSummary = {
  id: string;
  name?: string;
  isPublic?: boolean;
  buttons?: any[];
  updated_at?: string;
  created_at?: string;
  description?: string;
  tags?: string[];
};

const dashboardId = (id: string) => id.replace("dashboard:", "");

const formatDate = (value?: string) => {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const getWidgetColor = (type?: string) => {
  switch (type) {
    case "chart":
      return "border-purple-500/40 bg-purple-500/15 text-purple-300";
    case "table":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
    case "news":
      return "border-blue-500/40 bg-blue-500/15 text-blue-300";
    case "toggle":
      return "border-cyan-500/40 bg-cyan-500/15 text-cyan-300";
    case "form":
      return "border-amber-500/40 bg-amber-500/15 text-amber-300";
    case "infographic":
      return "border-pink-500/40 bg-pink-500/15 text-pink-300";
    case "button":
    default:
      return "border-indigo-500/40 bg-indigo-500/15 text-indigo-300";
  }
};

const getWidgetIcon = (type?: string) => {
  switch (type) {
    case "chart": return "📊";
    case "table": return "📋";
    case "news": return "📰";
    case "toggle": return "🎚️";
    case "form": return "📝";
    case "infographic": return "📈";
    default: return "⚡";
  }
};

export default function DashboardLibrary() {
  const navigate = useNavigate();
  const [search, setSearch] = createSignal("");
  const [widgetFilter, setWidgetFilter] = createSignal("all");
  const [sortBy, setSortBy] = createSignal<"updated" | "widgets" | "name">("updated");
  const [maximizedId, setMaximizedId] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");
  const [session, setSession] = createSignal<any | null>(null);
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);

  const [dashboards, { refetch }] = createResource<DashboardSummary[]>(async () => {
    setError("");
    try {
      const url = isServer
        ? `http://127.0.0.1:${process.env.PORT || 3000}/api/dashboards?published=true`
        : `/api/dashboards?published=true`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load library");
      return (json.data || []).filter((d: any) => d.isPublic);
    } catch (e: any) {
      console.error("[Dashboard Library] Fetch error:", e);
      setError(e.message);
      return [];
    }
  });

  const allTags = createMemo(() => {
    const tagSet = new Set<string>();
    for (const d of dashboards() || []) {
      for (const tag of d.tags || []) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  });

  const filteredDashboards = createMemo(() => {
    let list = [...(dashboards() || [])];
    const q = search().toLowerCase().trim();
    const tag = widgetFilter();
    const sTags = selectedTags();

    if (q) {
      list = list.filter((d) => {
        const nameMatch = (d.name || "").toLowerCase().includes(q);
        const descMatch = (d.description || "").toLowerCase().includes(q);
        const tagMatch = (d.tags || []).some((t) => t.toLowerCase().includes(q));
        const widgetMatch = (d.buttons || []).some((b: any) =>
          (b.label || "").toLowerCase().includes(q) || (b.widgetType || "").toLowerCase().includes(q)
        );
        return nameMatch || descMatch || tagMatch || widgetMatch;
      });
    }

    if (tag !== "all") {
      list = list.filter((d) =>
        (d.buttons || []).some((b: any) => (b.widgetType || "button") === tag)
      );
    }

    if (sTags.length > 0) {
      list = list.filter((d) =>
        sTags.every((st) => (d.tags || []).includes(st))
      );
    }

    if (sortBy() === "updated") {
      list.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
    } else if (sortBy() === "widgets") {
      list.sort((a, b) => (b.buttons?.length || 0) - (a.buttons?.length || 0));
    } else if (sortBy() === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return list;
  });

  const maximizedDashboard = createMemo(() => {
    const id = maximizedId();
    if (!id) return null;
    return (dashboards() || []).find((d) => d.id === id) || null;
  });

  onMount(() => {
    if (isServer) return;
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setSession(s && Object.keys(s).length > 0 ? s : null))
      .catch(() => setSession(null));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && maximizedId()) {
        setMaximizedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const widgetKindCounts = (buttons: any[] = []) => {
    const counts: Record<string, number> = {};
    for (const b of buttons) {
      const type = b.widgetType || "button";
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  };

  const renderMiniBlueprint = (buttons: any[] = []) => {
    if (!buttons || buttons.length === 0) {
      return (
        <div class="flex items-center justify-center h-full min-h-[90px] text-xs text-zinc-500 italic">
          No widgets placed yet
        </div>
      );
    }
    return (
      <div class="grid grid-cols-12 gap-1.5 w-full auto-rows-fr">
        <For each={buttons}>
          {(btn) => {
            const dims = getDefaultWidgetDimensions(btn.widgetType);
            const w = Math.min(12, Math.max(1, btn.w || dims.w || 3));
            const h = Math.max(1, btn.h || dims.h || 1);
            const color = getWidgetColor(btn.widgetType);
            const icon = getWidgetIcon(btn.widgetType);

            const colStyle = () => {
              if (btn.x !== undefined && btn.x !== null) {
                const start = Math.min(12, Math.max(1, Number(btn.x) + 1));
                const span = Math.min(13 - start, w);
                return `${start} / span ${span}`;
              }
              return `span ${w}`;
            };

            const rowStyle = () => {
              if (btn.y !== undefined && btn.y !== null) {
                const start = Math.max(1, Number(btn.y) + 1);
                return `${start} / span ${h}`;
              }
              return undefined;
            };

            return (
              <div
                style={{
                  "grid-column": colStyle(),
                  ...(rowStyle() ? { "grid-row": rowStyle() } : {}),
                  "min-height": `${Math.max(26, h * 13)}px`,
                }}
                class={`rounded-lg border p-1.5 transition-all flex flex-col justify-between overflow-hidden shadow-sm ${color}`}
              >
                <div class="flex items-center gap-1.5 truncate">
                  <span class="text-xs">{icon}</span>
                  <span class="truncate font-semibold text-[11px]">
                    {btn.label || "Widget"}
                  </span>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    );
  };

  return (
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      {/* Hero Header & Filter Bar on Top (Always Stays) */}
      <Card class="mb-8 overflow-hidden bg-zinc-950/80 border-zinc-800/80">
        <div class="flex flex-col gap-6 border-b border-zinc-800/80 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="mb-2">
              <Badge variant="purple" class="gap-1.5">
                <span class="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                Public Dashboard Library
              </Badge>
            </div>
            <h1 class="text-3xl font-extrabold tracking-tight text-white">Dashboard Library</h1>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Explore and preview published dashboards arranged by their creators.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <Show when={maximizedId()}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMaximizedId(null)}
                class="flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
                Minimize (Esc)
              </Button>
            </Show>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={dashboards.loading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"></path><path d="M3 21v-5h5"></path><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"></path><path d="M21 3v5h-5"></path></svg>
              Refresh
            </Button>
            <Show when={session()}>
              <a href="/dashboards">
                <Button variant="primary" size="sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
                  Dashboard Manager
                </Button>
              </a>
            </Show>
          </div>
        </div>

        {/* Filter Bar (Search Stays) */}
        <div class="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-950/40">
          <div class="flex-1 flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div class="relative flex-1">
              <svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
              <Input
                type="text"
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                placeholder="Search by dashboard name or widget..."
                class="pl-10"
              />
            </div>

            {/* Widget Filter Chips */}
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <For
                each={[
                  { id: "all", label: "All" },
                  { id: "chart", label: "Charts" },
                  { id: "table", label: "Tables" },
                  { id: "news", label: "Alerts" },
                  { id: "button", label: "Buttons" },
                  { id: "form", label: "Forms" },
                  { id: "toggle", label: "Toggles" },
                ]}
              >
                {(chip) => (
                  <button
                    type="button"
                    onClick={() => setWidgetFilter(chip.id)}
                    class={`rounded-lg px-3 py-2 text-xs font-semibold transition-all shrink-0 select-none ${
                      widgetFilter() === chip.id
                        ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800/80"
                    }`}
                  >
                    {chip.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Tag Filter Chips */}
          <Show when={allTags().length > 0}>
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 border-t border-zinc-800/60 pt-3 mt-1 px-5">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 shrink-0 mr-1">Tags:</span>
              <For each={allTags()}>
                {(tag) => (
                  <button
                    type="button"
                    onClick={() => {
                      const current = selectedTags();
                      if (current.includes(tag)) {
                        setSelectedTags(current.filter((t) => t !== tag));
                      } else {
                        setSelectedTags([...current, tag]);
                      }
                    }}
                    class={`rounded-lg px-3 py-2 text-xs font-semibold transition-all shrink-0 select-none ${
                      selectedTags().includes(tag)
                        ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800/80"
                    }`}
                  >
                    {tag}
                  </button>
                )}
              </For>
              <Show when={selectedTags().length > 0}>
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  class="rounded-lg px-2 py-2 text-[10px] font-medium text-zinc-500 hover:text-white transition-colors shrink-0"
                >
                  Clear
                </button>
              </Show>
            </div>
          </Show>

          {/* Sort Selector & Count */}
          <div class="flex items-center gap-3 shrink-0 p-5 pt-3">
            <label class="text-xs text-zinc-400">Sort by:</label>
            <select
              value={sortBy()}
              onChange={(e) => setSortBy(e.currentTarget.value as any)}
              class="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none transition-colors"
            >
              <option value="updated">Recently Updated</option>
              <option value="widgets">Most Widgets</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <Badge variant="purple">
              {filteredDashboards().length} {filteredDashboards().length === 1 ? "board" : "boards"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Main Content Area: Maximized View OR Multi-Card Grid */}
      <Show
        when={maximizedDashboard()}
        fallback={
          <div>
            <div class="mb-5 flex items-center justify-between">
              <h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                All Published Dashboards
              </h2>
              <span class="text-xs text-zinc-500 font-mono">
                {filteredDashboards().length} {filteredDashboards().length === 1 ? "dashboard" : "dashboards"} available
              </span>
            </div>

            <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 transition-all duration-300">
              <Suspense fallback={<div class="col-span-full py-12 text-center text-zinc-400">Loading published library...</div>}>
                <Show when={error()}>
                  <div class="col-span-full rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    {error()}
                  </div>
                </Show>

                <Show when={!dashboards.loading && filteredDashboards().length === 0}>
                  <div class="col-span-full rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-12 text-center">
                    <p class="text-base font-semibold text-white">No matching dashboards found</p>
                    <p class="mt-1 text-sm text-zinc-400">Try adjusting your search terms or widget filter.</p>
                  </div>
                </Show>

                <For each={filteredDashboards()}>
                  {(d) => {
                    const counts = widgetKindCounts(d.buttons || []);

                    return (
                      <Card
                        class="flex flex-col justify-between h-full border border-zinc-800/80 bg-zinc-950/75 hover:border-purple-500/50 hover:bg-zinc-900/60 transition-all duration-200"
                      >
                        <CardHeader class="p-5 pb-3">
                          <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                              <CardTitle class="truncate text-base font-bold text-white transition-colors hover:text-purple-300">
                                {d.name || "Untitled Dashboard"}
                              </CardTitle>
                              <CardDescription class="mt-1">
                                Updated {formatDate(d.updated_at || d.created_at)} • {d.buttons?.length || 0} widgets
                              </CardDescription>
                            </div>
                            <Badge variant="success" class="shrink-0">Published</Badge>
                          </div>
                        </CardHeader>

                        <CardContent class="p-5 pt-0 pb-3 flex-1 flex flex-col justify-between gap-3">
                          {/* Description Area (replaces blueprint preview) */}
                          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 min-h-[90px] max-h-[140px] overflow-hidden flex flex-col">
                            <Show
                              when={d.description}
                              fallback={
                                <div class="flex items-center justify-center h-full min-h-[60px] text-xs text-zinc-500 italic">
                                  No description provided
                                </div>
                              }
                            >
                              <p class="text-sm text-zinc-300 leading-relaxed line-clamp-4">
                                {d.description}
                              </p>
                            </Show>
                          </div>

                          {/* Tags */}
                          <Show when={d.tags && d.tags.length > 0}>
                            <div class="flex flex-wrap gap-1.5 pt-1">
                              <For each={d.tags}>
                                {(tag) => <Badge variant="purple">{tag}</Badge>}
                              </For>
                            </div>
                          </Show>

                          {/* Widget Type Badges */}
                          <div class="flex flex-wrap gap-1.5 pt-1">
                            <Show when={counts.chart}>
                              <Badge variant="purple">📊 {counts.chart} {counts.chart === 1 ? "Chart" : "Charts"}</Badge>
                            </Show>
                            <Show when={counts.table}>
                              <Badge variant="success">📋 {counts.table} {counts.table === 1 ? "Table" : "Tables"}</Badge>
                            </Show>
                            <Show when={counts.news}>
                              <Badge variant="blue">📰 {counts.news} {counts.news === 1 ? "Feed" : "Feeds"}</Badge>
                            </Show>
                            <Show when={counts.button}>
                              <Badge variant="secondary">⚡ {counts.button} {counts.button === 1 ? "Button" : "Buttons"}</Badge>
                            </Show>
                            <Show when={counts.form}>
                              <Badge variant="amber">📝 {counts.form} {counts.form === 1 ? "Form" : "Forms"}</Badge>
                            </Show>
                            <Show when={counts.toggle}>
                              <Badge variant="outline">🎚️ {counts.toggle} {counts.toggle === 1 ? "Toggle" : "Toggles"}</Badge>
                            </Show>
                          </div>
                        </CardContent>

                        <CardFooter class="p-4 pt-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-xs">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setMaximizedId(d.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            class="text-xs flex items-center gap-1.5"
                            title="Maximize dashboard over whole width"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                            <span>Maximize</span>
                          </Button>

                          <a
                            href={`/p/${dashboardId(d.id)}`}
                            target="_blank"
                            class="font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors"
                          >
                            <span>Open Public View</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                          </a>
                        </CardFooter>
                      </Card>
                    );
                  }}
                </For>
              </Suspense>
            </div>
          </div>
        }
      >
        {(dash) => (
          /* Maximized Dashboard (Viewable Over the Whole Width) */
          <div class="w-full">
            <Card class="overflow-hidden border-purple-500/40 bg-zinc-950/90 shadow-2xl">
              {/* Maximized Header Control Bar */}
              <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
                <div class="flex items-center gap-3">
                  <span class="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-purple-600/20 text-purple-400 font-bold text-lg border border-purple-500/30">
                    ⛶
                  </span>
                  <div>
                    <div class="flex items-center gap-2">
                      <h2 class="text-2xl font-extrabold text-white tracking-tight">{dash().name || "Untitled Dashboard"}</h2>
                      <Badge variant="purple">Maximized</Badge>
                      <Badge variant="success">Published</Badge>
                    </div>
                    <p class="text-xs text-zinc-400 mt-1">
                      Updated {formatDate(dash().updated_at || dash().created_at)} • {dash().buttons?.length || 0} widgets arranged by owner
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setMaximizedId(null)}
                    title="Restore Grid View (Esc)"
                    class="flex items-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
                    <span>Minimize (Esc)</span>
                  </Button>

                  <Show when={session()}>
                    <a
                      href={`/dashboards/${dashboardId(dash().id)}`}
                      class="hidden sm:inline-flex"
                    >
                      <Button variant="outline" size="sm" class="flex items-center gap-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Edit & Arrange
                      </Button>
                    </a>
                  </Show>

                  <a
                    href={`/p/${dashboardId(dash().id)}`}
                    target="_blank"
                  >
                    <Button variant="primary" size="sm" class="flex items-center gap-1.5">
                      <span>Open Public View</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </Button>
                  </a>
                </div>
              </div>

              {/* Maximized Full-Width GridStack Content */}
              <div class="p-6 bg-zinc-950/70 min-h-[420px]">
                <Show
                  when={(dash().buttons || []).length > 0}
                  fallback={
                    <div class="py-20 text-center text-zinc-500 text-sm italic">
                      This dashboard has no widgets configured yet.
                    </div>
                  }
                >
                  <DashboardGrid
                    buttons={dash().buttons || []}
                    isStatic={true}
                    dashboardId={dashboardId(dash().id)}
                    renderWidget={(btn) => (
                      <div class="flex flex-col h-full justify-between gap-3">
                        <div class="flex items-center justify-between pb-2 border-b border-zinc-800">
                          <div class="flex items-center gap-2">
                            <span class="text-lg">
                              {btn.widgetType === "chart" ? "📊" : btn.widgetType === "table" ? "📋" : btn.widgetType === "news" ? "📰" : btn.widgetType === "toggle" ? "🎚️" : "⚡"}
                            </span>
                            <span class="font-bold text-white text-sm">{btn.label || "Widget"}</span>
                          </div>
                          <span class="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
                            {btn.widgetType || "button"}
                          </span>
                        </div>

                        <div class="flex-1 flex items-center justify-center py-4 text-center">
                          <Show when={btn.widgetType === "chart"}>
                            <div class="text-xs text-purple-300 font-medium">
                              📈 {btn.chartType ? btn.chartType.toUpperCase() : "BAR"} Chart • {btn.workflowId ? "Linked to Workflow" : "Configured"}
                            </div>
                          </Show>
                          <Show when={btn.widgetType === "table"}>
                            <div class="text-xs text-emerald-300 font-medium">
                              📋 Dynamic Table Grid • {btn.columns ? `${btn.columns.split(",").length} Columns` : "Auto Columns"}
                            </div>
                          </Show>
                          <Show when={btn.widgetType === "news"}>
                            <div class="text-xs text-blue-300 font-medium">
                              📰 Live Streaming Feed & Alert Rules
                            </div>
                          </Show>
                          <Show when={btn.widgetType === "toggle"}>
                            <div class="text-xs text-cyan-300 font-medium">
                              🎚️ Active/Inactive State Switch
                            </div>
                          </Show>
                          <Show when={btn.widgetType === "button" || !btn.widgetType}>
                            <div class="text-xs text-zinc-300 font-medium">
                              ⚡ Interactive Trigger Action
                            </div>
                          </Show>
                          <Show when={btn.widgetType === "form"}>
                            <div class="text-xs text-amber-300 font-medium">
                              📝 Input Form ({btn.formConfig?.length || 0} fields)
                            </div>
                          </Show>
                        </div>

                        <div class="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                          <span>Dimensions: {btn.w || getDefaultWidgetDimensions(btn.widgetType).w} × {btn.h || getDefaultWidgetDimensions(btn.widgetType).h}</span>
                          <a
                            href={`/p/${dashboardId(dash().id)}`}
                            target="_blank"
                            class="text-purple-400 hover:text-purple-300 font-semibold"
                          >
                            Interact ↗
                          </a>
                        </div>
                      </div>
                    )}
                  />
                </Show>
              </div>
            </Card>
          </div>
        )}
      </Show>
    </main>
  );
}
