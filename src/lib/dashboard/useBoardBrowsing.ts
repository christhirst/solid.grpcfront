import { createEffect, createMemo, createSignal } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { dashboardId, type DashboardSummary } from "./boardTypes";

/**
 * Selection + prev/next navigation across the (filtered) list of boards.
 * The selection is mirrored to `?board=<id>` (replace, no scroll reset) so it can be shared.
 */
export function useBoardBrowsing(boards: () => DashboardSummary[], isDesktop: () => boolean) {
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  let initialized = false;

  const index = createMemo(() => boards().findIndex((b) => b.id === selectedId()));

  const select = (id: string | null) => {
    setSelectedId(id);
    setParams({ board: id ? dashboardId(id) : undefined }, { replace: true, scroll: false });
  };

  const step = (dir: 1 | -1) => {
    const list = boards();
    if (!list.length) return;
    const i = index();
    const nextIndex = i < 0 ? (dir === 1 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
    select(list[nextIndex].id);
  };

  createEffect(() => {
    const list = boards();
    if (!list.length) return;

    if (!initialized) {
      initialized = true;
      const raw = params.board;
      const fromUrl = typeof raw === "string" && raw ? list.find((b) => dashboardId(b.id) === raw) : undefined;
      if (fromUrl) {
        setSelectedId(fromUrl.id);
        return;
      }
    }

    const current = selectedId();
    const stillThere = current !== null && list.some((b) => b.id === current);
    if (stillThere) return;

    // Selected board was filtered out / nothing selected yet:
    // desktop always shows a board, phones fall back to the collapsed grid.
    select(isDesktop() ? list[0].id : null);
  });

  return {
    selectedId,
    select,
    index,
    total: () => boards().length,
    next: () => step(1),
    prev: () => step(-1),
  };
}
