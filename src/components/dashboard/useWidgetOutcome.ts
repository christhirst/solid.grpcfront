import { createSignal, onMount, onCleanup } from "solid-js";
import { extractRunOutcome } from "~/lib/dashboard/widgetConditions";
import { pollRun, triggerWidgetRun } from "~/lib/dashboard/runPolling";
import type { WidgetConfig } from "~/lib/dashboard/widgetTypes";

export type OutcomeStatus = "loading" | "ready" | "error";

export interface WidgetOutcome {
  data: unknown;
  logs?: any[];
  status: OutcomeStatus;
  error: string;
}

/** Run a widget's bound workflow once on mount and expose the last successful outcome. */
export function useWidgetOutcome(dashboardId: string | undefined, btn: WidgetConfig) {
  const [outcome, setOutcome] = createSignal<WidgetOutcome>({ data: undefined, status: "loading", error: "" });
  let disposed = false;
  let cancelPoll: (() => void) | undefined;

  onCleanup(() => {
    disposed = true;
    cancelPoll?.();
  });

  onMount(async () => {
    const targetWfId = btn.conditionWorkflowId || btn.workflowId;
    if (!dashboardId || !targetWfId) {
      setOutcome({ data: undefined, status: "ready", error: "" });
      return;
    }

    const hasConditions = (btn.conditionRules ?? []).length > 0;
    if (!hasConditions) {
      setOutcome({ data: undefined, status: "ready", error: "" });
      return;
    }

    try {
      const runId = await triggerWidgetRun(dashboardId, btn.id, {}, btn.conditionWorkflowId);
      if (disposed) return;
      cancelPoll = pollRun(
        runId,
        {
          onDone: (logs) => {
            if (disposed) return;
            setOutcome({ data: extractRunOutcome(logs), logs, status: "ready", error: "" });
          },
          onError: (msg) => {
            if (disposed) return;
            setOutcome({ data: undefined, status: "error", error: msg });
          },
        },
        { maxAttempts: 60, intervalMs: 1500 }
      );
    } catch (e: any) {
      if (disposed) return;
      setOutcome({ data: undefined, status: "error", error: e.message || "Failed to load widget state" });
    }
  });

  return outcome;
}
