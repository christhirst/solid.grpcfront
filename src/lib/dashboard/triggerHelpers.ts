import { RecordId } from "surrealdb";
import {
  parseListFieldValue,
  type FormSequenceConfig,
  type FormValidatorType,
  type SurveyConfig,
} from "~/lib/dashboard/widgetTypes";

export interface TriggerPayload {
  form?: Record<string, unknown>;
  workflowId?: string;
  seriesRun?: boolean;
  /** Survey step whose fields should be validated (per-step workflow runs). */
  surveyStepId?: string;
  /** When true the submitted values are not persisted back into the dashboard definition. */
  ephemeral?: boolean;
}

export interface DashboardButton {
  id: string;
  widgetType?: string;
  surveyConfig?: SurveyConfig;
  sequenceConfig?: FormSequenceConfig;
  workflowId: string;
  conditionWorkflowId?: string;
  conditionRules?: Array<{ action?: string; targetValue?: string; elseAction?: string; elseTargetValue?: string }>;
  chartSeries?: Array<{ workflowId?: string }>;
  formConfig?: Array<{
    name: string;
    label?: string;
    type?: string;
    required?: boolean;
    options?: string;
    value?: unknown;
    defaultValue?: unknown;
    validator?: FormValidatorType;
    validatorPattern?: string;
    validatorMin?: number;
    validatorMax?: number;
    validatorMessage?: string;
  }>;
}

export interface DashboardRecord {
  id: string | { tb: string; id: string } | RecordId<string, string>;
  buttons: DashboardButton[];
}

/** Normalize a SurrealDB/URL id to the raw string part, stripping table prefix and chevrons. */
export function normalizeId(id: string): string {
  if (!id) return "";
  const raw = id.includes(":") ? id.split(":")[1] : id;
  return raw.replace(/[⟨⟩]/g, "").trim();
}

/** Compute the allowlist of workflow IDs permitted to execute for this button/widget. */
export function allowedWorkflowIds(button: any): Set<string> {
  const allowed = new Set<string>();
  if (!button) return allowed;

  if (button.workflowId) {
    allowed.add(normalizeId(button.workflowId));
  }
  if (button.conditionWorkflowId) {
    allowed.add(normalizeId(button.conditionWorkflowId));
  }
  if (Array.isArray(button.conditionRules)) {
    for (const rule of button.conditionRules) {
      if (rule.action === "setWorkflow" && rule.targetValue) {
        allowed.add(normalizeId(rule.targetValue));
      }
      if (rule.elseAction === "setWorkflow" && rule.elseTargetValue) {
        allowed.add(normalizeId(rule.elseTargetValue));
      }
    }
  }
  if (Array.isArray(button.chartSeries)) {
    for (const series of button.chartSeries) {
      if (series.workflowId) {
        allowed.add(normalizeId(series.workflowId));
      }
    }
  }
  if (Array.isArray(button.surveyConfig?.steps)) {
    for (const step of button.surveyConfig.steps) {
      if (step?.workflowId) {
        allowed.add(normalizeId(step.workflowId));
      }
    }
  }

  return allowed;
}

/** Find the button by id inside a dashboard record. */
export function findButton(dashboard: DashboardRecord, buttonId: string): DashboardButton | undefined {
  return (dashboard.buttons || []).find((b) => b.id === buttonId);
}

/** Merge saved/default form field values into the submitted payload. */
export function mergeFormPayload(
  submitted: Record<string, unknown>,
  formConfig: DashboardButton["formConfig"]
): Record<string, unknown> {
  const merged = { ...submitted };
  if (!Array.isArray(formConfig)) return merged;

  for (const field of formConfig) {
    if (!field.name) continue;
    if (merged[field.name] === undefined || merged[field.name] === "") {
      const savedVal = field.value ?? field.defaultValue;
      if (savedVal !== undefined && savedVal !== "") {
        merged[field.name] = savedVal;
      }
    }
    if ((field.type === "list" || field.type === "checkbox_group") && merged[field.name] !== undefined) {
      merged[field.name] = parseListFieldValue(merged[field.name]);
    }
  }
  return merged;
}

/** Build the updated button list after a trigger, persisting submitted form values. */
export function buildUpdatedButtons(
  buttons: DashboardButton[],
  buttonId: string,
  formPayload: Record<string, unknown>
): DashboardButton[] {
  return buttons.map((candidate) => {
    if (candidate.id !== buttonId) return candidate;
    return {
      ...candidate,
      lastFormPayload: formPayload,
      formConfig: Array.isArray(candidate.formConfig)
        ? candidate.formConfig.map((field) =>
            field.name && Object.prototype.hasOwnProperty.call(formPayload, field.name)
              ? { ...field, value: formPayload[field.name] }
              : field
          )
        : candidate.formConfig,
    };
  });
}
