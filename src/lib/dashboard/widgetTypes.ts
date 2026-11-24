/**
 * Shared, strongly-typed models for dashboard widgets.
 *
 * These types intentionally mirror the current persisted shape so the
 * refactor stays backward-compatible. Using named types instead of `any`
 * lets condition evaluation and rendering be implemented as small,
 * pure functions.
 */

import type { FormValidatorType } from "~/lib/formValidator";
export type { FormValidatorType };

export type WidgetType = "button" | "form" | "survey" | "chart" | "table" | "news" | "toggle" | "infographic";

export type ConditionOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "truthy"
  | "falsy"
  | "gt"
  | "lt"
  | "gte"
  | "lte";

export type ConditionAction =
  | "showWidget"
  | "hideWidget"
  | "showForm"
  | "hideForm"
  | "setLabel"
  | "setWorkflow"
  | "setColor"
  | "setDisabled"
  | "setEnabled";

export interface ConditionRule {
  id: string;
  /** Dot-separated path into the workflow outcome. Empty string means the root value. */
  path?: string;
  operator: ConditionOperator;
  /** Value to compare against. Ignored for truthy/falsy. */
  value?: unknown;
  action: ConditionAction;
  /** New label or workflowId, depending on action. */
  targetValue?: string;
  /** Action to apply when the condition does NOT match. */
  elseAction?: ConditionAction;
  /** Target value for the else action (e.g. alternate label, color). */
  elseTargetValue?: string;
}

export type FormFieldType =
  | "string"
  | "number"
  | "boolean"
  | "select"
  | "radio"
  | "checkbox_group"
  | "rating"
  | "date"
  | "list"
  | "textarea";

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  defaultValue?: unknown;
  value?: unknown;
  options?: string;
  description?: string;
  placeholder?: string;
  /** Rating scale upper bound (default 5; UI supports 5 or 10). */
  ratingMax?: number;
  ratingMinLabel?: string;
  ratingMaxLabel?: string;
  validator?: FormValidatorType;
  validatorPattern?: string;
  validatorMin?: number;
  validatorMax?: number;
  validatorMessage?: string;
}

export type SurveyBranchOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "isEmpty"
  | "isNotEmpty";

export interface SurveyBranchRule {
  id: string;
  field: string;
  operator: SurveyBranchOperator;
  value?: string;
  /** Step ID to jump to, or "__complete__" to finish early. */
  targetStepId: string;
}

export interface SurveyStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  workflowId?: string;
  nextLabel?: string;
  branchRules?: SurveyBranchRule[];
}

export interface SurveyConfig {
  steps: SurveyStep[];
  showProgress?: boolean;
  allowBack?: boolean;
  passAccumulatedAnswers?: boolean;
  completionTitle?: string;
  completionMessage?: string;
  allowRestart?: boolean;
  showSummary?: boolean;
}

export interface FormSequenceConfig {
  hideOnSubmit?: boolean;
  startsHidden?: boolean;
  nextWidgetId?: string;
  carryAnswersForward?: boolean;
  completionMessage?: string;
  allowRestart?: boolean;
}

/**
 * Parses a list form field value (array, JSON array string, or comma/newline-separated
 * string with optional quotes) into a clean array of non-empty strings.
 */
export function parseListFieldValue(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => parseListFieldValue(item));
  }
  if (typeof raw !== "string") {
    const str = String(raw).trim();
    return str ? [str] : [];
  }
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => parseListFieldValue(item));
      }
    } catch {
      // Fall through to lenient splitting
    }
  }
  const unwrapped = trimmed.replace(/^\[+|\]+$/g, "");
  return unwrapped
    .split(/[\r\n,]+/)
    .map((part) =>
      part
        .trim()
        .replace(/^\[+|\]+$/g, "")
        .trim()
        .replace(/^["']+|["']+$/g, "")
        .trim()
    )
    .filter((item) => item.length > 0);
}

/**
 * Formats a list form field value for editing in a text/textarea input.
 */
export function formatListFieldValue(raw: unknown): string {
  if (typeof raw === "string") return raw;
  return parseListFieldValue(raw).join(", ");
}

export interface OutputField {
  id: string;
  /** Human-readable label displayed above the value (e.g. "Email", "Surname"). */
  label: string;
  /** Variable extraction path, e.g. "{{ steps.step_8m6qd1ynu.response.email }}" or "response.email". */
  path: string;
}

export type ChartSeriesType = "bar" | "line" | "scatter" | "bubble" | "density" | "area";

export interface ChartSeriesConfig {
  id?: string;
  label: string;
  yKey: string;
  type: ChartSeriesType;
  axis?: "left" | "right";
  color?: string;
  workflowId?: string;
  rKey?: string;
  xKey?: string;
}

export interface WidgetConfig {
  id: string;
  label: string;
  widgetType: WidgetType;
  workflowId: string;
  color?: string;
  chartType?: string;
  chartSeries?: ChartSeriesConfig[];
  xKey?: string;
  yKey?: string;
  columns?: string;
  formConfig?: FormField[];
  dataPath?: string;
  streamActive?: boolean;
  newsRules?: any[];
  onLabel?: string;
  offLabel?: string;
  formVarName?: string;
  defaultChecked?: boolean;
  infographicSyntax?: string;
  infographicTemplate?: string;
  infographicEditable?: boolean;
  /** Optional alternate workflow to evaluate conditions against (e.g. read source query). Defaults to workflowId. */
  conditionWorkflowId?: string;
  /** Conditional rules evaluated against the bound workflow's outcome. */
  conditionRules?: ConditionRule[];
  /** Whether the widget displays an output/response field. */
  showOutput?: boolean;
  /** Configured output fields to extract and display from the response. */
  outputConfig?: OutputField[];
  /** Multi-step survey definition (widgetType "survey"). */
  surveyConfig?: SurveyConfig;
  /** Sequential form chaining (widgetType "form"). */
  sequenceConfig?: FormSequenceConfig;
  /** Optional layout position/size persisted by the GridStack arranger. */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface EffectiveWidgetConfig {
  hidden: boolean;
  formHidden: boolean;
  label: string;
  workflowId: string;
  color?: string;
  disabled?: boolean;
}
