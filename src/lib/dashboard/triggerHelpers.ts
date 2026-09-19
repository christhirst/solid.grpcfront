import { RecordId } from "surrealdb";

export interface TriggerPayload {
  form?: Record<string, unknown>;
  workflowId?: string;
}

export interface DashboardButton {
  id: string;
  workflowId: string;
  formConfig?: Array<{ name: string; value?: unknown; defaultValue?: unknown }>;
}

export interface DashboardRecord {
  id: string | { tb: string; id: string } | RecordId<string, string>;
  buttons: DashboardButton[];
}

/** Normalize a SurrealDB/URL id to the raw string part. */
export function normalizeId(id: string): string {
  return id.includes(":") ? id.split(":")[1] : id;
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
    if (merged[field.name] !== undefined && merged[field.name] !== "") continue;
    const savedVal = field.value ?? field.defaultValue;
    if (savedVal !== undefined && savedVal !== "") {
      merged[field.name] = savedVal;
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
