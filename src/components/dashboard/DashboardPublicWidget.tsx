import { Show, createSignal } from "solid-js";
import { DashboardButtonFormWidget } from "./DashboardButtonFormWidget";
import { useWidgetOutcome } from "./useWidgetOutcome";
import { applyWidgetConditions } from "~/lib/dashboard/widgetConditions";
import type { WidgetConfig } from "~/lib/dashboard/widgetTypes";

export type WidgetExecutionState = "idle" | "running" | "success" | "error";

export interface DashboardPublicWidgetProps {
  btn: WidgetConfig;
  dashboardId: string;
  executing: Record<string, WidgetExecutionState>;
  formState: Record<string, Record<string, unknown>>;
  updateForm: (btnId: string, field: string, value: unknown) => void;
  triggerButton: (btn: WidgetConfig, effectiveWorkflowId?: string) => Promise<void>;
  /** Optional child component for table/chart/news/toggle/infographic. */
  children?: any;
}

/** Renders a button/form widget with conditional rules applied from the workflow outcome. */
export function DashboardPublicButtonFormWidget(props: DashboardPublicWidgetProps) {
  const { btn, dashboardId, executing, formState, updateForm, triggerButton } = props;
  const outcome = useWidgetOutcome(dashboardId, btn);
  const effective = () => applyWidgetConditions(btn, outcome().data);

  const handleTrigger = async () => {
    await triggerButton(btn, effective().workflowId);
  };

  return (
    <DashboardButtonFormWidget
      btn={btn}
      effective={effective()}
      state={executing[btn.id] || "idle"}
      formState={formState}
      updateForm={updateForm}
      onTrigger={handleTrigger}
    />
  );
}
