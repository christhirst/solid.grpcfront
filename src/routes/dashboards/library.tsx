import { createSignal, createMemo, createResource, createEffect, on, For, Show, Suspense, onMount, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import BoardSidebar from "~/components/dashboard/BoardSidebar";
import BoardPreview, { BoardLive } from "~/components/dashboard/BoardPreview";
import BoardNavBar from "~/components/dashboard/BoardNavBar";
import { dashboardId, formatDate, type DashboardSummary } from "~/lib/dashboard/boardTypes";
import { useBoardBrowsing } from "~/lib/dashboard/useBoardBrowsing";
import { useSlideshow } from "~/lib/dashboard/useSlideshow";
import { useSwipe } from "~/lib/dashboard/useSwipe";
import { useMediaQuery } from "~/lib/useMediaQuery";

export default function DashboardLibrary() {
  const [search, setSearch] = createSignal("");
  const [widgetFilter, setWidgetFilter] = createSignal("all");
  const [sortBy, setSortBy] = createSignal<"updated" | "widgets" | "name">("updated");
  const [error, setError] = createSignal("");
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
  // ── Browsing: desktop = sidebar + preview pane, phones = card grid with swipe ──
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const browsing = useBoardBrowsing(filteredDashboards, isDesktop);
  const slideshow = useSlideshow(
    () => browsing.next(),
    () => filteredDashboards().length > 1 && browsing.selectedId() !== null
  );

  const goNext = () => { browsing.next(); slideshow.restart(); };
  const goPrev = () => { browsing.prev(); slideshow.restart(); };
  const selectBoard = (id: string | null) => { browsing.select(id); slideshow.restart(); };

  const selectedBoard = createMemo(
    () => filteredDashboards().find((d) => d.id === browsing.selectedId()) || null
  );

  const toggleExpanded = (id: string) => selectBoard(browsing.selectedId() === id ? null : id);

  // Phones: whenever the expanded card changes (tap, swipe, arrows, slideshow, deep link), scroll it into view.
  createEffect(
    on(browsing.selectedId, (id) => {
      if (isServer || !id || isDesktop()) return;
      setTimeout(() => {
        document.getElementById(`lib-${dashboardId(id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    })
  );

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape" && !isDesktop() && browsing.selectedId()) selectBoard(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  /** Error / empty states shared by both layouts. */
  const statusMessages = () => (
    <>
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

      <Show when={!dashboards.loading && filteredDashboards().length === 0 && !error()}>
        <div class="col-span-full rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-12 text-center">
          <p class="text-base font-semibold text-white">No matching dashboards found</p>
          <p class="mt-1 text-sm text-zinc-400">Try adjusting your search terms or widget filter.</p>
        </div>
      </Show>
    </>
  );


  /** Phone/tablet card: expands in place, swipe or Prev/Next to browse. */
  const PhoneCard = (p: { d: DashboardSummary }) => {
    const expanded = () => browsing.selectedId() === p.d.id;
    const swipe = useSwipe({ onLeft: goNext, onRight: goPrev, enabled: expanded });

    return (
      <Card
        id={`lib-${dashboardId(p.d.id)}`}
        onPointerDown={swipe.onPointerDown}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
        class={`flex flex-col justify-between border bg-zinc-950/75 transition-all duration-200 scroll-mt-20 ${
          expanded()
            ? "col-span-full touch-pan-y border-purple-500/50 bg-zinc-950/90 shadow-2xl"
            : "h-full border-zinc-800/80 hover:border-purple-500/50 hover:bg-zinc-900/60"
        }`}
      >
        <CardHeader class="p-5 pb-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <CardTitle class={`text-base font-bold text-white transition-colors hover:text-purple-300 ${expanded() ? "text-xl" : "truncate"}`}>
                {p.d.name || "Untitled Dashboard"}
              </CardTitle>
              <CardDescription class="mt-1">
                Updated {formatDate(p.d.updated_at || p.d.created_at)} • {p.d.buttons?.length || 0} widgets
              </CardDescription>
            </div>
            <Badge variant="success" class="shrink-0">Published</Badge>
          </div>
        </CardHeader>

        <CardContent class="p-5 pt-0 pb-3 flex-1 flex flex-col justify-between gap-3">
          <div class={`rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 min-h-[90px] overflow-hidden flex flex-col ${expanded() ? "" : "max-h-[140px]"}`}>
            <Show
              when={p.d.description}
              fallback={
                <div class="flex items-center justify-center h-full min-h-[60px] text-xs text-zinc-500 italic">
                  No description provided
                </div>
              }
            >
              <p class={`text-sm text-zinc-300 leading-relaxed ${expanded() ? "" : "line-clamp-4"}`}>{p.d.description}</p>
            </Show>
          </div>

          <Show when={p.d.tags && p.d.tags.length > 0}>
            <div class="flex flex-wrap gap-1.5 pt-1">
              <For each={p.d.tags}>{(tag) => <Badge variant="purple">{tag}</Badge>}</For>
            </div>
          </Show>

          <Show when={expanded()}>
            <BoardNavBar
              compact
              index={browsing.index()}
              total={browsing.total()}
              onPrev={goPrev}
              onNext={goNext}
              slideshow={slideshow}
            />
            <p class="text-center text-[11px] text-zinc-500">Swipe left or right to browse boards</p>
            <BoardLive dash={p.d} />
          </Show>
        </CardContent>

        <CardFooter class="p-4 pt-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-xs">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toggleExpanded(p.d.id)}
            class="text-xs flex items-center gap-1.5 min-h-[44px] sm:min-h-0"
            title={expanded() ? "Collapse dashboard (Esc)" : "Expand dashboard preview"}
          >
            <Show
              when={expanded()}
              fallback={
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                  <span>Expand</span>
                </>
              }
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
              <span>Collapse (Esc)</span>
            </Show>
          </Button>

          <a
            href={`/p/${dashboardId(p.d.id)}`}
            target="_blank"
            class="font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors min-h-[44px] sm:min-h-0"
          >
            <span>Open Public View</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </CardFooter>
      </Card>
    );
  };

  return (
    <main class="mx-auto max-w-7xl 2xl:max-w-[90rem] 3xl:max-w-[110rem] px-4 py-8 sm:px-6 lg:py-10 pb-24 sm:pb-10">
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
            <h1 class="text-4xl font-extrabold tracking-tight text-white">Dashboard Library</h1>
            <p class="mt-2 max-w-2xl text-base leading-6 text-zinc-400">
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
                    class={`rounded-lg px-3 py-2 text-sm font-semibold transition-all shrink-0 select-none ${
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
              <span class="text-xs font-semibold uppercase tracking-wide text-zinc-500 shrink-0 mr-1">Tags:</span>
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
                    class={`rounded-lg px-3 py-2 text-sm font-semibold transition-all shrink-0 select-none ${
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
                  class="rounded-lg px-2 py-2 text-xs font-medium text-zinc-500 hover:text-white transition-colors shrink-0"
                >
                  Clear
                </button>
              </Show>
            </div>
          </Show>

          {/* Sort Selector & Count */}
          <div class="flex items-center gap-3 shrink-0 p-5 pt-3">
            <label class="text-sm text-zinc-400">Sort by:</label>
            <select
              value={sortBy()}
              onChange={(e) => setSortBy(e.currentTarget.value as any)}
              class="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none transition-colors"
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

      <Suspense fallback={<div class="py-12 text-center text-zinc-400">Loading published library...</div>}>
        <Show
          when={isDesktop()}
          fallback={
            /* Phones / tablets: card grid, the expanded card spans the row and the others flow below it */
            <div>
              <div class="mb-5 flex items-center justify-between">
                <h2 class="text-lg font-bold text-white tracking-tight">All Published Dashboards</h2>
                <span class="text-xs text-zinc-500 font-mono">
                  {filteredDashboards().length} {filteredDashboards().length === 1 ? "dashboard" : "dashboards"} available
                </span>
              </div>
              <div class="grid grid-flow-row-dense grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
                {statusMessages()}
                <For each={filteredDashboards()}>{(d) => <PhoneCard d={d} />}</For>
              </div>
            </div>
          }
        >
          {/* Desktop: master-detail (sidebar with descriptions + public-style live preview) */}
          <div class="grid grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)] 2xl:grid-cols-[28rem_minmax(0,1fr)] gap-6 items-start">
            <BoardSidebar
              boards={filteredDashboards()}
              selectedId={browsing.selectedId()}
              onSelect={(id) => selectBoard(id)}
            />
            <div class="min-w-0">
              <Show when={selectedBoard()} keyed fallback={<div class="grid">{statusMessages()}</div>}>
                {(d) => (
                  <BoardPreview
                    dash={d}
                    index={browsing.index()}
                    total={browsing.total()}
                    onPrev={goPrev}
                    onNext={goNext}
                    slideshow={slideshow}
                  />
                )}
              </Show>
            </div>
          </div>
        </Show>
      </Suspense>
    </main>
  );
}
