import { createEffect, createMemo, createSignal, on } from "solid-js";
import {
  computeInitialVisibleWidgetIds,
  findChainRootId,
  getChainMemberIds,
  isWidgetInFormSequence,
} from "~/lib/dashboard/surveyEngine";

export interface SequenceSlot {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface CompletedChain extends SequenceSlot {
  id: string;
  rootId: string;
  title: string;
  message: string;
  allowRestart: boolean;
}

/**
 * Orchestrates sequential form chains: when a form with `hideOnSubmit` is submitted it disappears and
 * its `nextWidgetId` appears in the exact grid slot it vacated. The final form is replaced by a
 * completion card. Answers are accumulated per chain so later forms/workflows can receive them.
 */
export function useFormSequence(
  getButtons: () => any[],
  options?: { onClearForms?: (widgetIds: string[]) => void }
) {
  const initialVisible = () => computeInitialVisibleWidgetIds(getButtons());
  const [visibleIds, setVisibleIds] = createSignal<Set<string>>(initialVisible());
  const [slotOverrides, setSlotOverrides] = createSignal<Record<string, SequenceSlot>>({});
  const [chainedAnswers, setChainedAnswers] = createSignal<Record<string, Record<string, unknown>>>({});
  const [completedChains, setCompletedChains] = createSignal<Record<string, CompletedChain>>({});

  const hasSequence = createMemo(() => {
    const list = getButtons() || [];
    return list.some((b) => isWidgetInFormSequence(list, b.id));
  });

  // Reference-stable copies so <For> does not remount widgets unless their slot actually changed.
  const copyCache = new Map<string, { source: any; key: string; value: any }>();
  const stable = (source: any, slot: SequenceSlot | undefined, prefix = "") => {
    const key = `${slot?.x ?? ""},${slot?.y ?? ""}`;
    const cacheKey = `${prefix}${source.id}`;
    const hit = copyCache.get(cacheKey);
    if (hit && hit.source === source && hit.key === key) return hit.value;
    const value = { ...source, x: slot?.x ?? source.x, y: slot?.y ?? source.y };
    copyCache.set(cacheKey, { source, key, value });
    return value;
  };

  const displayedButtons = createMemo(() => {
    const list = getButtons() || [];
    if (!hasSequence()) return list;
    const visible = visibleIds();
    const overrides = slotOverrides();
    const shown = list
      .filter((b) => visible.has(b.id))
      .map((b) => (overrides[b.id] ? stable(b, overrides[b.id]) : b));
    const cards = Object.values(completedChains()).map((c) => {
      const cacheKey = `__complete__${c.rootId}`;
      const key = `${c.x ?? ""},${c.y ?? ""}`;
      const hit = copyCache.get(cacheKey);
      if (hit && hit.key === key && hit.source === c) return hit.value;
      const value = {
        id: c.id,
        rootId: c.rootId,
        widgetType: "__chain_complete__",
        label: c.title,
        message: c.message,
        allowRestart: c.allowRestart,
        x: c.x,
        y: c.y,
        w: c.w ?? 6,
        h: c.h ?? 3,
      };
      copyCache.set(cacheKey, { source: c, key, value });
      return value;
    });
    return [...shown, ...cards];
  });

  const carriedAnswers = (btn: any): Record<string, unknown> => {
    if (!btn || btn.sequenceConfig?.carryAnswersForward === false) return {};
    if (!isWidgetInFormSequence(getButtons(), btn.id)) return {};
    return chainedAnswers()[findChainRootId(getButtons(), btn.id)] || {};
  };

  const handleSubmitSuccess = (btn: any, submittedForm: Record<string, unknown>) => {
    const buttons = getButtons();
    const rootId = findChainRootId(buttons, btn.id);
    setChainedAnswers((prev) => ({ ...prev, [rootId]: { ...(prev[rootId] || {}), ...submittedForm } }));

    const cfg = btn.sequenceConfig;
    if (!cfg?.hideOnSubmit) return;

    const override = slotOverrides()[btn.id];
    const anchor: SequenceSlot = {
      x: override?.x ?? btn.x,
      y: override?.y ?? btn.y,
      w: btn.w,
      h: btn.h,
    };
    const nextId: string | undefined = cfg.nextWidgetId || undefined;
    const nextExists = !!nextId && buttons.some((b) => b.id === nextId);

    setVisibleIds((prev) => {
      const next = new Set(prev);
      next.delete(btn.id);
      if (nextExists && nextId) next.add(nextId);
      return next;
    });

    if (nextExists && nextId) {
      setSlotOverrides((prev) => ({ ...prev, [nextId]: { x: anchor.x, y: anchor.y } }));
    } else {
      setCompletedChains((prev) => ({
        ...prev,
        [rootId]: {
          id: `__chain_complete__${rootId}`,
          rootId,
          title: btn.label || "Completed",
          message: cfg.completionMessage || "Thank you! Your responses have been submitted.",
          allowRestart: cfg.allowRestart !== false,
          ...anchor,
        },
      }));
    }
  };

  const resetChain = (rootId: string) => {
    const members = getChainMemberIds(getButtons(), rootId);
    const initial = initialVisible();
    setVisibleIds((prev) => {
      const next = new Set(prev);
      for (const m of members) {
        if (initial.has(m)) next.add(m);
        else next.delete(m);
      }
      return next;
    });
    setSlotOverrides((prev) => {
      const next = { ...prev };
      for (const m of members) delete next[m];
      return next;
    });
    setChainedAnswers((prev) => {
      const next = { ...prev };
      delete next[rootId];
      return next;
    });
    setCompletedChains((prev) => {
      const next = { ...prev };
      delete next[rootId];
      return next;
    });
    options?.onClearForms?.(members);
  };

  /** Restores every chain to its initial state (used by the builder preview). */
  const resetAll = () => {
    const all = (getButtons() || []).map((b) => b.id);
    setVisibleIds(initialVisible());
    setSlotOverrides({});
    setChainedAnswers({});
    setCompletedChains({});
    options?.onClearForms?.(all);
  };

  // Re-sync when widgets are added/removed or their "starts hidden" flag changes.
  createEffect(
    on(
      () => (getButtons() || []).map((b) => `${b.id}:${b.sequenceConfig?.startsHidden ? 1 : 0}`).join("|"),
      () => resetAll(),
      { defer: true }
    )
  );

  const isAdvanced = () =>
    Object.keys(slotOverrides()).length > 0 ||
    Object.keys(completedChains()).length > 0 ||
    Object.keys(chainedAnswers()).length > 0;

  return {
    displayedButtons,
    hasSequence,
    carriedAnswers,
    handleSubmitSuccess,
    resetChain,
    resetAll,
    isAdvanced,
  };
}
