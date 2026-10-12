import { dashboardId } from "./boardTypes";

export const NAMESPACE_MAX_LENGTH = 40;
export const SLUG_MAX_LENGTH = 80;

export function slugFromName(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .slice(0, SLUG_MAX_LENGTH).replace(/^-+|-+$/g, "");
}

export function urlPartError(value: unknown, label: "Namespace" | "Dashboard URL"): string | undefined {
  const max = label === "Namespace" ? NAMESPACE_MAX_LENGTH : SLUG_MAX_LENGTH;
  if (typeof value !== "string" || !value) return `${label} is required.`;
  if (value.length > max) return `${label} must be ${max} characters or fewer.`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return `${label} must use lowercase letters, numbers, and single hyphens between words.`;
  }
}

export function publicDashboardPath(dashboard: { id: string; namespace?: string; slug?: string }): string {
  if (dashboard.namespace && dashboard.slug) {
    return `/p/${encodeURIComponent(dashboard.namespace)}/${encodeURIComponent(dashboard.slug)}`;
  }
  return `/p/${encodeURIComponent(dashboardId(dashboard.id))}`;
}
