import { RecordId } from "surrealdb";
import { allowedWorkflowIds, normalizeId } from "./triggerHelpers";
import { canAccessObject, type EffectiveAccessContext } from "~/lib/groupAuth";

/**
 * Determine whether `workflowId` is referenced by `dashboardId` AND the caller (`ctx`)
 * is allowed to view that dashboard.
 *
 * This allows `user` and `viewer` roles (as well as anonymous viewers of published dashboards)
 * to execute and stream workflows wired into dashboards they can view, without granting them
 * direct access to the Workflows management category.
 */
export async function canUseWorkflowViaDashboard(
  db: any,
  ctx: EffectiveAccessContext,
  dashboardIdRaw: string | null | undefined,
  workflowIdRaw: string
): Promise<boolean> {
  const cleanDashId = normalizeId(dashboardIdRaw || "");
  const cleanWfId = normalizeId(workflowIdRaw || "");
  if (!cleanDashId || !cleanWfId || !db) return false;

  try {
    const res = await db.select(new RecordId("dashboard", cleanDashId));
    const dashboard = Array.isArray(res) ? res[0] : res;
    if (!dashboard) return false;

    const canViewDashboard =
      canAccessObject(ctx, dashboard, "dashboard", "view") ||
      (dashboard.isPublic === true && !ctx.isSimulating);
    if (!canViewDashboard) return false;

    const buttons = Array.isArray(dashboard.buttons) ? dashboard.buttons : [];
    for (const btn of buttons) {
      if (allowedWorkflowIds(btn).has(cleanWfId)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}
