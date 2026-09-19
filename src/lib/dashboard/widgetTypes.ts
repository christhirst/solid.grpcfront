/**
 * Shared, strongly-typed models for dashboard widgets.
 *
 * These types intentionally mirror the current persisted shape so the
 * refactor stays backward-compatible. Using named types instead of `any`
 * lets condition evaluation and rendering be implemented as small,
 * pure functions.
 */

export type WidgetType = "button" | "form" | "chart" | "table" | "news" | "toggle" | "infographic";

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
  | "setWorkflow";

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
}

export interface FormField {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "textarea";
  required?: boolean;
  defaultValue?: unknown;
  value?: unknown;
  options?: string;
}

export interface WidgetConfig {
  id: string;
  label: string;
  widgetType: WidgetType;
  workflowId: string;
  color?: string;
  chartType?: string;
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
  /** Conditional rules evaluated against the bound workflow's outcome. */
  conditionRules?: ConditionRule[];
}

export interface EffectiveWidgetConfig {
  hidden: boolean;
  formHidden: boolean;
  label: string;
  workflowId: string;
}
