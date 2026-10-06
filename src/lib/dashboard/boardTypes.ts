export type DashboardSummary = {
  id: string;
  name?: string;
  isPublic?: boolean;
  buttons?: any[];
  updated_at?: string;
  created_at?: string;
  description?: string;
  tags?: string[];
};

/** Dashboard id without the "dashboard:" table prefix (used in URLs and API paths). */
export const dashboardId = (id: string) => id.replace("dashboard:", "");

export const formatDate = (value?: string) => {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};
