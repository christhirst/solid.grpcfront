import { parseListFieldValue } from "~/lib/dashboard/widgetTypes";
import { detectStepVariables } from "~/lib/workflowVariableChecker";

export type FormValidatorType =
  | "none"
  | "required"
  | "email"
  | "url"
  | "uuid"
  | "date"
  | "ipv4_host"
  | "json"
  | "alphanumeric"
  | "regex";

export const FORM_VALIDATOR_OPTIONS: Array<{
  value: FormValidatorType;
  label: string;
  hint?: string;
}> = [
  { value: "none", label: "None" },
  { value: "required", label: "Required (Non-empty)" },
  { value: "email", label: "Email Address" },
  { value: "url", label: "URL (http/https/ws/grpc/s3)" },
  { value: "uuid", label: "UUID" },
  { value: "date", label: "Date (YYYY-MM-DD)" },
  { value: "ipv4_host", label: "IPv4 / Hostname" },
  { value: "json", label: "Valid JSON" },
  { value: "alphanumeric", label: "Alphanumeric (a-z, 0-9, _, -)" },
  { value: "regex", label: "Custom Regex" },
];

export interface FormValidatorConfig {
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: string;
  validator?: FormValidatorType;
  validatorPattern?: string;
  validatorMin?: number;
  validatorMax?: number;
  validatorMessage?: string;
  ratingMax?: number;
}

export interface FieldValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?|wss?|grpc|grpcs|s3):\/\/[^\s/$.?#].[^\s]*$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const IPV4_RE = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(:\d{1,5})?$/;
const HOSTNAME_RE =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(:\d{1,5})?$/;
const ALPHANUMERIC_RE = /^[a-zA-Z0-9_-]+$/;

function parseBound(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function stripFormPrefix(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("form.")) return trimmed.slice(5);
  if (trimmed.startsWith("dashboard_form.")) return trimmed.slice(15);
  return trimmed;
}

/** Returns true if the field or variable has any validation rule configured. */
export function hasActiveValidator(config?: FormValidatorConfig): boolean {
  if (!config) return false;
  if (config.validator && config.validator !== "none") return true;
  if (config.required === true) return true;
  if (parseBound(config.validatorMin) !== undefined) return true;
  if (parseBound(config.validatorMax) !== undefined) return true;
  return false;
}

const BADGE_LABELS: Record<FormValidatorType, string> = {
  none: "",
  required: "Required",
  email: "Email",
  url: "URL",
  uuid: "UUID",
  date: "Date",
  ipv4_host: "IPv4/Host",
  json: "JSON",
  alphanumeric: "Alphanumeric",
  regex: "Regex",
};

/** Formats a concise badge string summarizing active validator constraints, or null when unconfigured. */
export function formatValidatorBadge(config?: FormValidatorConfig): string | null {
  if (!config) return null;
  const validator = config.validator || "none";
  const min = parseBound(config.validatorMin);
  const max = parseBound(config.validatorMax);

  const parts: string[] = [];
  if (validator !== "none") {
    parts.push(BADGE_LABELS[validator] || validator);
  } else if (config.required) {
    parts.push("Required");
  }

  if (min !== undefined && max !== undefined) {
    parts.push(`${min}..${max}`);
  } else if (min !== undefined) {
    parts.push(`Min ${min}`);
  } else if (max !== undefined) {
    parts.push(`Max ${max}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function validatePresetOrRegex(
  val: string,
  validator: FormValidatorType,
  pattern: string | undefined,
  label: string,
  fail: (msg: string) => FieldValidationResult
): FieldValidationResult {
  switch (validator) {
    case "none":
    case "required":
      return { valid: true };
    case "email":
      return EMAIL_RE.test(val) ? { valid: true } : fail(`${label} must be a valid email address.`);
    case "url":
      return URL_RE.test(val) ? { valid: true } : fail(`${label} must be a valid URL.`);
    case "uuid":
      return UUID_RE.test(val) ? { valid: true } : fail(`${label} must be a valid UUID.`);
    case "date": {
      if (!DATE_RE.test(val)) {
        return fail(`${label} must be a valid date (YYYY-MM-DD).`);
      }
      const [y, m, d] = val.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const isCalendarValid =
        dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
      return isCalendarValid ? { valid: true } : fail(`${label} must be a valid date (YYYY-MM-DD).`);
    }
    case "ipv4_host": {
      const hostPart = val.replace(/:\d+$/, "");
      if (/^\d+(\.\d+)*$/.test(hostPart)) {
        return IPV4_RE.test(val)
          ? { valid: true }
          : fail(`${label} must be a valid IPv4 address or hostname.`);
      }
      return IPV4_RE.test(val) || HOSTNAME_RE.test(val)
        ? { valid: true }
        : fail(`${label} must be a valid IPv4 address or hostname.`);
    }
    case "json":
      try {
        JSON.parse(val);
        return { valid: true };
      } catch {
        return fail(`${label} must be valid JSON.`);
      }
    case "alphanumeric":
      return ALPHANUMERIC_RE.test(val)
        ? { valid: true }
        : fail(`${label} must contain only letters, numbers, underscores, or hyphens.`);
    case "regex": {
      const trimmedPattern = pattern?.trim();
      if (!trimmedPattern) return { valid: true };
      try {
        const re = new RegExp(trimmedPattern);
        return re.test(val)
          ? { valid: true }
          : fail(`${label} does not match required pattern (${trimmedPattern}).`);
      } catch {
        return fail(`${label} has an invalid regex pattern (${trimmedPattern}).`);
      }
    }
    default:
      return { valid: true };
  }
}

/** Validates a single form field value against its configured type, bounds, preset, or regex. */
export function validateFormFieldValue(
  config: FormValidatorConfig,
  rawValue: unknown
): FieldValidationResult {
  const label = config.label?.trim() || config.name?.trim() || "Field";
  const validator: FormValidatorType = config.validator || "none";
  const min = parseBound(config.validatorMin);
  const max = parseBound(config.validatorMax);
  const hasMin = min !== undefined;
  const hasMax = max !== undefined;

  const fail = (defaultMsg: string): FieldValidationResult => ({
    valid: false,
    error: config.validatorMessage?.trim() || defaultMsg,
  });

  if (config.type === "boolean") {
    if ((config.required || validator === "required") && rawValue !== true) {
      return fail(`${label} must be enabled.`);
    }
    return { valid: true };
  }

  const isCheckboxGroup = config.type === "checkbox_group";
  const isRating = config.type === "rating";
  const isList = config.type === "list" || isCheckboxGroup;
  const isNumber = config.type === "number" || isRating;
  const items = isList ? parseListFieldValue(rawValue) : [];
  const isEmpty = isList
    ? items.length === 0
    : rawValue === undefined || rawValue === null || String(rawValue).trim() === "";

  if (isEmpty) {
    if (config.required || validator === "required") {
      return fail(`${label} is required.`);
    }
    if (hasMin && min > 0 && (isList || !isNumber)) {
      return fail(
        isList
          ? `${label} requires at least ${min} item(s).`
          : `${label} must be at least ${min} character(s).`
      );
    }
    return { valid: true };
  }

  if (isNumber) {
    const num = typeof rawValue === "number" ? rawValue : Number(String(rawValue).trim());
    if (!Number.isFinite(num)) {
      return fail(`${label} must be a valid number.`);
    }
    const lowerBound = hasMin ? min : isRating ? 1 : undefined;
    const rawRatingMax = parseBound(config.ratingMax);
    const upperBound = hasMax ? max : isRating ? (rawRatingMax && rawRatingMax > 0 ? rawRatingMax : 5) : undefined;
    if (lowerBound !== undefined && num < lowerBound) {
      return fail(`${label} must be at least ${lowerBound}.`);
    }
    if (upperBound !== undefined && num > upperBound) {
      return fail(`${label} must be at most ${upperBound}.`);
    }
    if (validator !== "none" && validator !== "required") {
      return validatePresetOrRegex(String(num), validator, config.validatorPattern, label, fail);
    }
    return { valid: true };
  }

  if (isList) {
    if (hasMin && items.length < min) {
      return fail(`${label} must contain at least ${min} item(s).`);
    }
    if (hasMax && items.length > max) {
      return fail(`${label} must contain at most ${max} item(s).`);
    }
    if (isCheckboxGroup && config.options?.trim()) {
      const allowed = config.options
        .split(/[\r\n,]+/)
        .map((o) => o.trim())
        .filter(Boolean);
      const invalid = items.find((item) => !allowed.includes(item));
      if (allowed.length > 0 && invalid !== undefined) {
        return fail(`${label} must only contain: ${allowed.join(", ")}.`);
      }
    }
    for (const item of items) {
      const itemRes = validatePresetOrRegex(item, validator, config.validatorPattern, label, fail);
      if (!itemRes.valid) return itemRes;
    }
    return { valid: true };
  }

  const str = String(rawValue).trim();
  if ((config.type === "select" || config.type === "radio") && config.options?.trim()) {
    const allowed = config.options
      .split(/[\r\n,]+/)
      .map((o) => o.trim())
      .filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(str)) {
      return fail(`${label} must be one of: ${allowed.join(", ")}.`);
    }
  }

  if (config.type === "date" && validator !== "date") {
    const dateRes = validatePresetOrRegex(str, "date", undefined, label, fail);
    if (!dateRes.valid) return dateRes;
  }

  if (hasMin && str.length < min) {
    return fail(`${label} must be at least ${min} character(s).`);
  }
  if (hasMax && str.length > max) {
    return fail(`${label} must be at most ${max} character(s).`);
  }

  return validatePresetOrRegex(str, validator, config.validatorPattern, label, fail);
}

/** Adapter for @modular-forms/solid `<Field validate={...}>` (returns "" when valid). */
export function createModularFieldValidator(config: FormValidatorConfig): (value: unknown) => string {
  return (value: unknown) => {
    const res = validateFormFieldValue(config, value);
    return res.valid ? "" : res.error || "Invalid value";
  };
}

/** Validates an entire form payload against a list of field validator configurations. */
export function validateFormPayload(
  fields: FormValidatorConfig[],
  payload: Record<string, unknown>
): { valid: boolean; errors: Record<string, string>; firstError?: string } {
  const errors: Record<string, string> = {};
  let firstError: string | undefined;

  for (const field of fields || []) {
    const key = field.name?.trim();
    if (!key) continue;
    const cleanKey = stripFormPrefix(key);
    const rawVal =
      payload?.[key] !== undefined
        ? payload[key]
        : payload?.[cleanKey] !== undefined
          ? payload[cleanKey]
          : (field as any).value ?? (field as any).defaultValue;
    const res = validateFormFieldValue(field, rawVal);
    if (!res.valid && res.error) {
      errors[key] = res.error;
      if (!firstError) firstError = res.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    firstError,
  };
}

const FORM_FIELD_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "select",
  "radio",
  "checkbox_group",
  "rating",
  "date",
  "list",
  "textarea",
]);

function normalizeFieldType(rawType?: string): string {
  return rawType && FORM_FIELD_TYPES.has(rawType) ? rawType : "string";
}

/**
 * Merges dashboard formConfig entries with workflow downstream StepVariable definitions.
 * Explicit dashboard formConfig settings take precedence; unset fields fall back to the workflow variable.
 */
export function mergeWorkflowAndFormValidatorConfigs(
  workflow: any,
  formConfig?: FormValidatorConfig[]
): FormValidatorConfig[] {
  const workflowDownstreamByName = new Map<string, any>();

  for (const step of workflow?.steps || []) {
    for (const sv of detectStepVariables(step)) {
      if (sv.direction !== "down" || sv.isLiteral || !sv.name) continue;
      const cleanName = stripFormPrefix(sv.name);
      if (!cleanName) continue;
      const existing = workflowDownstreamByName.get(cleanName);
      if (!existing || (!hasActiveValidator(existing) && hasActiveValidator(sv))) {
        workflowDownstreamByName.set(cleanName, sv);
      }
    }
  }

  const merged: FormValidatorConfig[] = [];
  const seenCleanNames = new Set<string>();

  for (const fc of formConfig || []) {
    const rawName = fc?.name?.trim() || "";
    if (!rawName) continue;
    const cleanName = stripFormPrefix(rawName);
    seenCleanNames.add(cleanName);
    const sv = workflowDownstreamByName.get(cleanName);

    merged.push({
      ...fc,
      name: rawName,
      label: fc.label?.trim() || sv?.alias?.trim() || cleanName,
      type: fc.type ? normalizeFieldType(fc.type) : normalizeFieldType(sv?.type),
      options: fc.options !== undefined && fc.options !== "" ? fc.options : sv?.options,
      required: fc.required !== undefined ? fc.required : sv?.required,
      validator: fc.validator !== undefined ? fc.validator : sv?.validator,
      validatorPattern:
        fc.validatorPattern !== undefined && fc.validatorPattern !== ""
          ? fc.validatorPattern
          : sv?.validatorPattern,
      validatorMin:
        fc.validatorMin !== undefined && fc.validatorMin !== null
          ? fc.validatorMin
          : sv?.validatorMin,
      validatorMax:
        fc.validatorMax !== undefined && fc.validatorMax !== null
          ? fc.validatorMax
          : sv?.validatorMax,
      validatorMessage:
        fc.validatorMessage !== undefined && fc.validatorMessage !== ""
          ? fc.validatorMessage
          : sv?.validatorMessage,
    });
  }

  for (const [cleanName, sv] of workflowDownstreamByName.entries()) {
    if (seenCleanNames.has(cleanName) || !hasActiveValidator(sv)) continue;
    merged.push({
      name: cleanName,
      label: sv.alias?.trim() || cleanName,
      type: normalizeFieldType(sv.type),
      options: sv.options,
      required: sv.required,
      validator: sv.validator,
      validatorPattern: sv.validatorPattern,
      validatorMin: sv.validatorMin,
      validatorMax: sv.validatorMax,
      validatorMessage: sv.validatorMessage,
    });
  }

  return merged;
}

/** Validates a submitted form payload against merged workflow + dashboard form validator rules. */
export function validateWorkflowFormPayload(
  workflow: any,
  formConfig: FormValidatorConfig[] | undefined,
  payload: Record<string, unknown>
): { valid: boolean; errors: Record<string, string>; firstError?: string } {
  const configs = mergeWorkflowAndFormValidatorConfigs(workflow, formConfig);
  return validateFormPayload(configs, payload);
}
