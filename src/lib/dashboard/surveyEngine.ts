/**
 * Pure helpers for multi-step surveys and sequential form chains on dashboards.
 * No browser/DOM access — safe for SSR and unit tests.
 */
import {
  formatListFieldValue,
  parseListFieldValue,
  type FormField,
  type FormSequenceConfig,
  type SurveyBranchRule,
  type SurveyConfig,
  type SurveyStep,
} from "./widgetTypes";

export const SURVEY_COMPLETE_TARGET = "__complete__" as const;

export type SurveyNext =
  | { type: "step"; index: number; stepId: string }
  | { type: "complete" };

/** Splits an options string on commas or newlines. */
export function parseOptionsList(options?: string): string[] {
  if (!options) return [];
  return options
    .split(/[\r\n,]+/)
    .map((o) => o.trim())
    .filter(Boolean);
}

function isEmptyAnswer(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (Array.isArray(raw)) return raw.length === 0;
  return String(raw).trim() === "";
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Evaluates a single branch rule against the answers collected so far. */
export function evaluateBranchRule(
  rule: Pick<SurveyBranchRule, "field" | "operator" | "value">,
  answers: Record<string, unknown>
): boolean {
  const raw = answers?.[rule.field];
  const target = norm(rule.value);

  switch (rule.operator) {
    case "isEmpty":
      return isEmptyAnswer(raw);
    case "isNotEmpty":
      return !isEmptyAnswer(raw);
    case "equals":
      return Array.isArray(raw) ? raw.some((item) => norm(item) === target) : norm(raw) === target;
    case "notEquals":
      return Array.isArray(raw) ? !raw.some((item) => norm(item) === target) : norm(raw) !== target;
    case "contains":
      return Array.isArray(raw)
        ? raw.some((item) => norm(item).includes(target))
        : norm(raw).includes(target);
    case "gt":
    case "lt":
    case "gte":
    case "lte": {
      if (isEmptyAnswer(raw) || isEmptyAnswer(rule.value)) return false;
      const a = Number(raw);
      const b = Number(rule.value);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (rule.operator === "gt") return a > b;
      if (rule.operator === "lt") return a < b;
      if (rule.operator === "gte") return a >= b;
      return a <= b;
    }
    default:
      return false;
  }
}

/** Resolves which step (or completion) follows the current step given the answers. */
export function resolveNextSurveyStep(
  steps: SurveyStep[],
  currentIndex: number,
  answers: Record<string, unknown>
): SurveyNext {
  const rules = steps[currentIndex]?.branchRules || [];
  for (const rule of rules) {
    if (!evaluateBranchRule(rule, answers)) continue;
    if (rule.targetStepId === SURVEY_COMPLETE_TARGET) return { type: "complete" };
    const targetIndex = steps.findIndex((s) => s.id === rule.targetStepId);
    if (targetIndex !== -1 && targetIndex !== currentIndex) {
      return { type: "step", index: targetIndex, stepId: steps[targetIndex].id };
    }
  }
  if (currentIndex + 1 < steps.length) {
    return { type: "step", index: currentIndex + 1, stepId: steps[currentIndex + 1].id };
  }
  return { type: "complete" };
}

/** Walks the survey from step 0 following branches and returns visited step indices. */
export function collectVisitedSurveyStepIndices(
  steps: SurveyStep[],
  answers: Record<string, unknown>
): number[] {
  const visited: number[] = [];
  const seen = new Set<number>();
  let index = 0;
  while (index >= 0 && index < steps.length && !seen.has(index)) {
    seen.add(index);
    visited.push(index);
    const next = resolveNextSurveyStep(steps, index, answers);
    if (next.type === "complete") break;
    index = next.index;
  }
  return visited;
}

/** Fields of every step actually visited (skipped branches are excluded). */
export function collectVisitedSurveyFields(
  steps: SurveyStep[],
  answers: Record<string, unknown>
): FormField[] {
  return collectVisitedSurveyStepIndices(steps, answers).flatMap((i) => steps[i]?.fields || []);
}

/** Initial form values across all steps, shaped for @modular-forms/solid. */
export function buildSurveyInitialValues(steps: SurveyStep[]): Record<string, any> {
  const values: Record<string, any> = {};
  for (const step of steps || []) {
    for (const field of step.fields || []) {
      if (!field.name) continue;
      const seed = field.value ?? field.defaultValue;
      switch (field.type) {
        case "checkbox_group":
          values[field.name] = parseListFieldValue(seed);
          break;
        case "boolean":
          values[field.name] = Boolean(seed ?? false);
          break;
        case "list":
          values[field.name] = formatListFieldValue(seed);
          break;
        default:
          values[field.name] = seed === undefined || seed === null ? "" : String(seed);
      }
    }
  }
  return values;
}

/** Normalizes a raw form value into its submission shape. */
export function normalizeSurveyFieldValue(field: Pick<FormField, "type">, raw: unknown): unknown {
  switch (field.type) {
    case "list":
    case "checkbox_group":
      return parseListFieldValue(raw);
    case "number":
    case "rating": {
      if (raw === undefined || raw === null || String(raw).trim() === "") return "";
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    case "boolean":
      return Boolean(raw);
    default:
      return raw === undefined || raw === null ? "" : String(raw);
  }
}

export function normalizeSurveyStepAnswers(
  fields: FormField[],
  rawValues: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields || []) {
    if (!field.name) continue;
    out[field.name] = normalizeSurveyFieldValue(field, rawValues?.[field.name]);
  }
  return out;
}

/** Builds the `form` payload sent to a step/final survey workflow. */
export function buildSurveyWorkflowPayload(
  steps: SurveyStep[],
  visitedIndices: number[],
  currentIndex: number,
  rawValues: Record<string, unknown>,
  passAccumulated: boolean
): Record<string, unknown> {
  const current = steps[currentIndex];
  const payload: Record<string, unknown> = {};

  if (passAccumulated) {
    const indices = [...new Set([...visitedIndices, currentIndex])].filter((i) => steps[i]);
    const byStep: Record<string, Record<string, unknown>> = {};
    for (const i of indices) {
      const answers = normalizeSurveyStepAnswers(steps[i].fields, rawValues);
      byStep[steps[i].id] = answers;
      Object.assign(payload, answers);
    }
    payload._survey_steps = byStep;
  } else if (current) {
    Object.assign(payload, normalizeSurveyStepAnswers(current.fields, rawValues));
  }

  payload._survey_step_id = current?.id ?? "";
  payload._survey_step_index = currentIndex;
  return payload;
}

export function createDefaultSurveyConfig(): SurveyConfig {
  const stamp = Math.random().toString(36).slice(2, 8);
  return {
    showProgress: true,
    allowBack: true,
    passAccumulatedAnswers: true,
    allowRestart: true,
    showSummary: false,
    completionTitle: "Thank you!",
    completionMessage: "Your responses have been submitted.",
    steps: [
      {
        id: `step_${stamp}_1`,
        title: "Your Details",
        description: "Tell us a little about yourself.",
        fields: [
          { name: "respondent_name", label: "Your name", type: "string", required: true },
          {
            name: "respondent_email",
            label: "Email",
            type: "string",
            validator: "email",
          },
        ],
        branchRules: [],
      },
      {
        id: `step_${stamp}_2`,
        title: "Your Feedback",
        description: "How did we do?",
        fields: [
          {
            name: "satisfaction",
            label: "Overall satisfaction",
            type: "rating",
            ratingMax: 5,
            ratingMinLabel: "Poor",
            ratingMaxLabel: "Excellent",
            required: true,
          },
          { name: "comments", label: "Comments", type: "textarea", required: false },
        ],
        branchRules: [],
      },
    ],
  };
}

// ─── Sequential form chain helpers ───────────────────────────────────────────

export interface SequenceNode {
  id: string;
  sequenceConfig?: FormSequenceConfig;
}

/** Widgets that are visible when a dashboard first loads. */
export function computeInitialVisibleWidgetIds(buttons: SequenceNode[]): Set<string> {
  const ids = new Set<string>();
  for (const b of buttons || []) {
    if (b?.id && b.sequenceConfig?.startsHidden !== true) ids.add(b.id);
  }
  return ids;
}

/** Walks backwards along nextWidgetId pointers to the chain starting widget. */
export function findChainRootId(buttons: SequenceNode[], widgetId: string): string {
  const seen = new Set<string>([widgetId]);
  let current = widgetId;
  for (;;) {
    const parent = (buttons || []).find(
      (b) => b.id !== current && b.sequenceConfig?.nextWidgetId === current && !seen.has(b.id)
    );
    if (!parent) return current;
    seen.add(parent.id);
    current = parent.id;
  }
}

/** Follows nextWidgetId pointers forward from rootId (inclusive). */
export function getChainMemberIds(buttons: SequenceNode[], rootId: string): string[] {
  const members: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = rootId;
  while (current && !seen.has(current)) {
    seen.add(current);
    members.push(current);
    const node = (buttons || []).find((b) => b.id === current);
    current = node?.sequenceConfig?.nextWidgetId || undefined;
  }
  return members;
}

export function isWidgetInFormSequence(buttons: SequenceNode[], widgetId: string): boolean {
  const node = (buttons || []).find((b) => b.id === widgetId);
  const cfg = node?.sequenceConfig;
  if (cfg?.hideOnSubmit || cfg?.startsHidden || cfg?.nextWidgetId) return true;
  return (buttons || []).some((b) => b.sequenceConfig?.nextWidgetId === widgetId);
}
