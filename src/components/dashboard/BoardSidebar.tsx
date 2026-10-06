import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { formatDate, type DashboardSummary } from "~/lib/dashboard/boardTypes";

export interface BoardSidebarProps {
  boards: DashboardSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Desktop board list. Wide enough to read the description of every board.
 * The mouse wheel scrolls the list while hovering; on hover, up/down buttons appear
 * (click = page up/down, press-and-hold = continuous scroll).
 */
export default function BoardSidebar(props: BoardSidebarProps) {
  let listRef!: HTMLDivElement;
  const [canUp, setCanUp] = createSignal(false);
  const [canDown, setCanDown] = createSignal(false);

  const updateEdges = () => {
    if (!listRef) return;
    setCanUp(listRef.scrollTop > 4);
    setCanDown(listRef.scrollTop + listRef.clientHeight < listRef.scrollHeight - 4);
  };

  onMount(() => {
    updateEdges();
    const ro = new ResizeObserver(updateEdges);
    ro.observe(listRef);
    onCleanup(() => ro.disconnect());
  });

  createEffect(() => {
    props.boards.length;
    queueMicrotask(updateEdges);
  });

  // Keep the active board visible inside the list (without scrolling the page itself).
  createEffect(() => {
    const id = props.selectedId;
    if (!id) return;
    requestAnimationFrame(() => {
      const el = listRef?.querySelector<HTMLElement>(`[data-board-id="${CSS.escape(id)}"]`);
      if (!el) return;
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (top < listRef.scrollTop) listRef.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
      else if (bottom > listRef.scrollTop + listRef.clientHeight)
        listRef.scrollTo({ top: bottom - listRef.clientHeight + 8, behavior: "smooth" });
    });
  });

  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let raf = 0;
  let holding = false;

  const startHold = (dir: 1 | -1) => {
    holding = false;
    holdTimer = setTimeout(() => {
      holding = true;
      const loop = () => {
        listRef.scrollTop += dir * 10;
        raf = requestAnimationFrame(loop);
      };
      loop();
    }, 250);
  };

  const endHold = (dir: 1 | -1, commit: boolean) => {
    clearTimeout(holdTimer);
    cancelAnimationFrame(raf);
    if (commit && !holding) listRef.scrollBy({ top: dir * listRef.clientHeight * 0.8, behavior: "smooth" });
    holding = false;
  };

  onCleanup(() => {
    clearTimeout(holdTimer);
    cancelAnimationFrame(raf);
  });

  const scrollButton = (dir: 1 | -1) => (
    <button
      type="button"
      aria-label={dir === -1 ? "Scroll boards up" : "Scroll boards down"}
      onPointerDown={() => startHold(dir)}
      onPointerUp={() => endHold(dir, true)}
      onPointerLeave={() => endHold(dir, false)}
      onPointerCancel={() => endHold(dir, false)}
      class={`absolute left-1/2 z-10 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/95 text-zinc-200 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-zinc-800 ${
        dir === -1 ? "top-2" : "bottom-2"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points={dir === -1 ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}></polyline>
      </svg>
    </button>
  );

  return (
    <aside
      class="group sticky top-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 shadow-xl"
      aria-label="Published dashboards"
    >
      <Show when={canUp()}>{scrollButton(-1)}</Show>
      <Show when={canDown()}>{scrollButton(1)}</Show>

      <div
        ref={listRef}
        onScroll={updateEdges}
        class="relative max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <For each={props.boards}>
          {(d) => {
            const active = () => props.selectedId === d.id;
            return (
              <button
                type="button"
                data-board-id={d.id}
                onClick={() => props.onSelect(d.id)}
                aria-current={active() ? "true" : undefined}
                class={`mb-2 block w-full rounded-xl border p-3.5 text-left transition-all duration-150 last:mb-0 ${
                  active()
                    ? "border-purple-500/60 bg-purple-500/10 shadow-md shadow-purple-500/10"
                    : "border-zinc-800/80 bg-zinc-900/40 hover:border-purple-500/40 hover:bg-zinc-900/80"
                }`}
              >
                <div class="flex items-start justify-between gap-2">
                  <span class={`truncate text-sm font-bold ${active() ? "text-white" : "text-zinc-100"}`}>
                    {d.name || "Untitled Dashboard"}
                  </span>
                  <span class="shrink-0 text-[10px] font-mono text-zinc-500">
                    {formatDate(d.updated_at || d.created_at)}
                  </span>
                </div>
                <Show
                  when={d.description}
                  fallback={<p class="mt-1.5 text-xs italic text-zinc-600">No description provided</p>}
                >
                  <p class="mt-1.5 line-clamp-3 text-xs leading-relaxed text-zinc-400">{d.description}</p>
                </Show>
                <Show when={d.tags && d.tags.length > 0}>
                  <div class="mt-2 flex flex-wrap gap-1">
                    <For each={(d.tags || []).slice(0, 3)}>
                      {(tag) => (
                        <Badge variant="purple" class="px-2 py-0 text-[10px]">
                          {tag}
                        </Badge>
                      )}
                    </For>
                  </div>
                </Show>
              </button>
            );
          }}
        </For>
      </div>
    </aside>
  );
}
