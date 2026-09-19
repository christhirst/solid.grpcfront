import { createSignal, onMount } from "solid-js";
import { extractRunOutcome } from "~/lib/dashboard/widgetConditions";
import { pollRun, triggerWidgetRun } from "~/lib/dashboard/runPolling";
import type { WidgetConfig } from "~/lib/dashboard/widgetTypes";

export type OutcomeStatus = "loading" | "ready" | "error";

export interface WidgetOutcome {
  data: unknown;
  status: OutcomeStatus;
  error: string;
}

/** Run a widget's bound workflow once on mount and expose the last successful outcome. */
export function useWidgetOutcome(dashboardId: string | undefined, btn: WidgetConfig) {
  const [outcome, setOutcome] = createSignal<WidgetOutcome>({ data: undefined, status: "loading", error: "" });

  onMount(async () => {
    if (!dashboardId || !btn.workflowId) {
      setOutcome({ data: undefined, status: "ready", error: "" });
      return;
    }

    const hasConditions = (btn.conditionRules ?? []).length > 0;
    if (!hasConditions) {
      setOutcome({ data: undefined, status: "ready", error: "" });
      return;
    }

    try {
      const runId = await triggerWidgetRun(dashboardId, btn.id);
      pollRun(
        runId,
        {
          onDone: (logs) => {
            setOutcome({ data: extractRunOutcome(logs), status: "ready", error: "" });
          },
          onError: (msg) => {
            setOutcome({ data: undefined, status: "error", error: msg });
          },
        },
        { maxAttempts: 60, intervalMs: 1500 }
      );
    } catch (e: any) {
      setOutcome({ data: undefined, status: "error", error: e.message || "Failed to load widget state" });
    }
  });

  return outcome;
}
