import { createSignal, createMemo, createResource, For, Show, Suspense } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { isServer } from "solid-js/web";
import { getDefaultWidgetDimensions } from "~/components/dashboard/DashboardGrid";
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
  const [error, setError] = createSignal("");

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

  const filteredDashboards = createMemo(() => {
    let list = [...(dashboards() || [])];
    const q = search().toLowerCase().trim();
    const tag = widgetFilter();

    if (q) {
      list = list.filter((d) => {
        const nameMatch = (d.name || "").toLowerCase().includes(q);
        const widgetMatch = (d.buttons || []).some((b: any) =>
          (b.label || "").toLowerCase().includes(q) || (b.widgetType || "").toLowerCase().includes(q)
        );
        return nameMatch || widgetMatch;
      });
    }

    if (tag !== "all") {
      list = list.filter((d) =>
        (d.buttons || []).some((b: any) => (b.widgetType || "button") === tag)
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

  const widgetKindCounts = (buttons: any[] = []) => {
    const counts: Record<string, number> = {};
    for (const b of buttons) {
      const type = b.widgetType || "button";
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  };

  const renderMiniBlueprint = (buttons: any[] = [], isZoomed = false) => {
    if (!buttons || buttons.length === 0) {
      return (
        <div class="flex items-center justify-center h-full min-h-[90px] text-xs text-zinc-500 italic">
          No widgets placed yet
        </div>
      );
    }
    return (
      <div class={`grid grid-cols-12 ${isZoomed ? "gap-2" : "gap-1.5"} w-full auto-rows-fr`}>
        <For each={buttons}>
          {(btn) => {
            const dims = getDefaultWidgetDimensions(btn.widgetType);
            const w = Math.min(12, Math.max(1, btn.w || dims.w || 4));
            const h = Math.max(1, btn.h || dims.h || 2);
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
                  "min-height": isZoomed ? `${Math.max(48, h * 24)}px` : `${Math.max(26, h * 13)}px`,
                }}
                class={`rounded-lg border p-1.5 transition-all flex flex-col justify-between overflow-hidden shadow-sm ${color}`}
              >
                <div class="flex items-center gap-1.5 truncate">
                  <span class={isZoomed ? "text-sm" : "text-xs"}>{icon}</span>
                  <span class={`truncate font-semibold ${isZoomed ? "text-xs text-white" : "text-[11px]"}`}>
                    {btn.label || "Widget"}
                  </span>
                </div>
                <Show when={isZoomed}>
                  <div class="flex items-center justify-between text-[10px] text-zinc-400 mt-1 pt-1 border-t border-white/10">
                    <span class="capitalize">{btn.widgetType || "button"}</span>
                    <span class="font-mono">{w}×{h}</span>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    );
  };

  return (
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      {/* Hero Header & Filter Bar on Top */}
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={dashboards.loading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"></path><path d="M3 21v-5h5"></path><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"></path><path d="M21 3v5h-5"></path></svg>
              Refresh
            </Button>
            <a href="/dashboards">
              <Button variant="primary" size="sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
                Dashboard Manager
              </Button>
            </a>
          </div>
        </div>

        {/* Filter Bar */}
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
              {[
                { id: "all", label: "All" },
                { id: "chart", label: "Charts" },
                { id: "table", label: "Tables" },
                { id: "news", label: "Alerts" },
                { id: "button", label: "Buttons" },
                { id: "form", label: "Forms" },
                { id: "toggle", label: "Toggles" },
              ].map((chip) => (
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
              ))}
            </div>
          </div>

          {/* Sort Selector & Count */}
          <div class="flex items-center gap-3 shrink-0">
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

      {/* Grid of Published Dashboards */}
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
                  <div class="relative group">
                    {/* Main Base Card */}
                    <Card
                      onClick={() => navigate(`/p/${dashboardId(d.id)}`)}
                      class="cursor-pointer flex flex-col justify-between h-full border border-zinc-800/80 bg-zinc-950/75 hover:border-purple-500/50 hover:bg-zinc-900/60 transition-all duration-200 select-none"
                    >
                      <CardHeader class="p-5 pb-3">
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <CardTitle class="truncate text-base font-bold text-white transition-colors group-hover:text-purple-300">
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
                        {/* Miniature Blueprint Preview Area */}
                        <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2.5 min-h-[120px] max-h-[160px] overflow-hidden flex flex-col justify-center">
                          <div class="flex items-center justify-between text-[10px] font-medium text-zinc-500 mb-1.5 pb-1 border-b border-zinc-800/60">
                            <span>12-Col Grid Blueprint</span>
                            <span class="text-purple-400 font-semibold group-hover:text-purple-300 flex items-center gap-1">
                              <span>Hover to Zoom</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                            </span>
                          </div>
                          {renderMiniBlueprint(d.buttons, false)}
                        </div>

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
                        <span class="text-zinc-500 text-[11px]">Click card to open</span>
                        <a
                          href={`/p/${dashboardId(d.id)}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          class="font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors"
                        >
                          <span>Open Public View</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </a>
                      </CardFooter>
                    </Card>

                    {/* Interactive Hover Zoom Preview Popover (Magnified Zoom Effect) */}
                    <div
                      class="absolute -inset-3.5 z-50 rounded-2xl border-2 border-purple-500/80 bg-zinc-950/98 p-5 shadow-2xl shadow-purple-500/30 backdrop-blur-2xl transition-all duration-300 ease-out pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto flex flex-col justify-between ring-1 ring-purple-500/30 cursor-pointer"
                      onClick={() => navigate(`/p/${dashboardId(d.id)}`)}
                    >
                      {/* Zoom Header */}
                      <div>
                        <div class="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                          <Badge variant="purple" class="gap-1 text-[10px]">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                            Zoom Preview (12 Columns)
                          </Badge>
                          <Badge variant="success">Published</Badge>
                        </div>

                        <div class="mt-2.5">
                          <h4 class="text-base font-bold text-white tracking-tight truncate">
                            {d.name || "Untitled Dashboard"}
                          </h4>
                          <p class="text-xs text-zinc-400 mt-0.5">
                            Updated {formatDate(d.updated_at || d.created_at)} • {d.buttons?.length || 0} widgets arranged
                          </p>
                        </div>
                      </div>

                      {/* Zoomed Blueprint Canvas */}
                      <div class="my-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 min-h-[160px] max-h-[220px] overflow-y-auto flex flex-col justify-center">
                        {renderMiniBlueprint(d.buttons, true)}
                      </div>

                      {/* Zoom Action Footer */}
                      <div class="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
                        <span class="text-xs text-zinc-400">Click to view public board</span>
                        <a
                          href={`/p/${dashboardId(d.id)}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="primary" size="sm" class="text-xs">
                            <span>Open Public View</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </Suspense>
        </div>
      </div>
    </main>
  );
}
