import { Show, createSignal } from "solid-js";
import { DashboardButtonFormWidget, type WidgetResponseOutcome } from "./DashboardButtonFormWidget";
import { useWidgetOutcome } from "./useWidgetOutcome";
import { applyWidgetConditions, extractRunOutcome } from "~/lib/dashboard/widgetConditions";
import { pollRun } from "~/lib/dashboard/runPolling";
import type { WidgetConfig } from "~/lib/dashboard/widgetTypes";

export type WidgetExecutionState = "idle" | "running" | "success" | "error";

export interface DashboardPublicWidgetProps {
  btn: WidgetConfig;
  dashboardId: string;
  executing: Record<string, WidgetExecutionState>;
  formState: Record<string, Record<string, unknown>>;
  updateForm: (btnId: string, field: string, value: unknown) => void;
  triggerButton: (btn: WidgetConfig, effectiveWorkflowId?: string) => Promise<any>;
  /** Optional child component for table/chart/news/toggle/infographic. */
  children?: any;
}

/** Renders a button/form widget with conditional rules and live response polling applied from the workflow outcome. */
export function DashboardPublicButtonFormWidget(props: DashboardPublicWidgetProps) {
  const outcome = useWidgetOutcome(props.dashboardId, props.btn);
  const [runOutcome, setRunOutcome] = createSignal<WidgetResponseOutcome>({ status: "idle" });

  const effectiveData = () => runOutcome().data ?? outcome().data;
  const effective = () => applyWidgetConditions(props.btn, effectiveData());

  const handleTrigger = async () => {
    const res = (await props.triggerButton(props.btn, effective().workflowId)) as any;
    const runId = res?.runId;
    const hasOutput = !!(props.btn.showOutput || (props.btn.outputConfig && props.btn.outputConfig.length > 0));

    if (runId && hasOutput) {
      setRunOutcome({ status: "running" });
      pollRun(
        runId,
        {
          onDone: (logs) => {
            const data = extractRunOutcome(logs);
            setRunOutcome({ status: "ready", data });
          },
          onError: (errMsg) => {
            setRunOutcome({ status: "error", error: errMsg });
          },
        },
        { maxAttempts: 60, intervalMs: 1000 }
      );
    }
  };

  const activeResponseOutcome = (): WidgetResponseOutcome => {
    if (runOutcome().status !== "idle") {
      return runOutcome();
    }
    if (outcome().status === "ready" && outcome().data !== undefined) {
      return { status: "ready", data: outcome().data };
    }
    if (outcome().status === "loading" && (props.btn.conditionRules?.length || 0) > 0) {
      return { status: "running" };
    }
    if (outcome().status === "error") {
      return { status: "error", error: outcome().error };
    }
    return { status: "idle" };
  };

  return (
    <DashboardButtonFormWidget
      btn={props.btn}
      effective={effective()}
      state={props.executing[props.btn.id] || (runOutcome().status === "running" ? "running" : "idle")}
      formState={props.formState}
      updateForm={props.updateForm}
      onTrigger={handleTrigger}
      responseOutcome={activeResponseOutcome()}
    />
  );
}
