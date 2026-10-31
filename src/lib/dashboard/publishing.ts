import { RecordId } from "surrealdb";
import { slugFromName, urlPartError } from "./publicUrl";
import { dashboardId } from "./boardTypes";
import {
  canAccessResource,
  normalizeGroupName,
  type EffectiveAccessContext,
  type GroupRight,
} from "~/lib/groupAuth";

// Structural interface also permits testing against an isolated SurrealDB instance.
interface PublishingDb {
  query: (sql: string, vars?: Record<string, any>) => Promise<any>;
  select: (id: any) => Promise<any>;
}

export class PublishingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const schemas = new WeakMap<PublishingDb, Promise<void>>();
export async function ensurePublishingSchema(db: PublishingDb): Promise<void> {
  let pending = schemas.get(db);
  if (!pending) {
    pending = db.query(`
      DEFINE TABLE IF NOT EXISTS user_profile TYPE NORMAL SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS dashboard TYPE NORMAL SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS group_namespace TYPE NORMAL SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS group_member TYPE NORMAL SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS user_namespace ON user_profile FIELDS namespace UNIQUE;
      DEFINE INDEX IF NOT EXISTS dashboard_public_url ON dashboard FIELDS namespace, slug UNIQUE;
      DEFINE INDEX IF NOT EXISTS group_member_idx ON group_member FIELDS group, username UNIQUE;
    `).then(() => {}).catch((err: unknown) => { schemas.delete(db); throw err; });
    schemas.set(db, pending);
  }
  await pending;
}

export const firstRecord = (result: any) => Array.isArray(result) ? result[0] : result;

export async function getUserProfile(db: PublishingDb, sub: string) {
  await ensurePublishingSchema(db);
  const record = firstRecord(await db.select(new RecordId("user_profile", sub)));
  return { namespace: record?.namespace || "" };
}

export async function saveUserNamespace(db: PublishingDb, sub: string, namespace: unknown) {
  const error = urlPartError(namespace, "Namespace");
  if (error) throw new PublishingError(error);
  await ensurePublishingSchema(db);
  // Rename the profile and its dashboard URLs together, or roll everything back.
  await db.query(`
    BEGIN TRANSACTION;
    UPSERT $profile MERGE { namespace: $namespace, updated_at: $now };
    UPDATE dashboard SET namespace = $namespace, updated_at = $now
      WHERE owner = $owner AND namespace != NONE;
    COMMIT TRANSACTION;
  `, { profile: new RecordId("user_profile", sub), namespace, owner: sub, now: new Date().toISOString() });
  return { namespace: namespace as string };
}

export function assertDashboardOwner(
  record: any,
  sub: string,
  requiredRight: GroupRight = "write",
  accessCtx?: EffectiveAccessContext
) {
  if (accessCtx) {
    if (!canAccessResource(accessCtx, record, requiredRight)) {
      const actionLabel = requiredRight === "delete" ? "delete" : "change";
      throw new PublishingError(
        `You do not have permission (${requiredRight}) to ${actionLabel} this dashboard.`,
        403
      );
    }
    return;
  }
  // Legacy dashboards may predate ownership, or have lost it to UPDATE CONTENT.
  if (record?.owner && record.owner !== "anonymous" && record.owner !== sub) {
    throw new PublishingError("Only the dashboard owner can change this dashboard.", 403);
  }
}

export async function saveDashboard(
  db: PublishingDb,
  sub: string,
  id: string,
  body: any,
  create = false,
  accessCtx?: EffectiveAccessContext
) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PublishingError("Invalid dashboard data.");
  if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") throw new PublishingError("Published must be true or false.");
  if (body.slug !== undefined && typeof body.slug !== "string") throw new PublishingError("Dashboard URL must be text.");
  await ensurePublishingSchema(db);
  const recordId = new RecordId("dashboard", dashboardId(id));
  const existing = create ? undefined : firstRecord(await db.select(recordId));
  if (!create && !existing) throw new PublishingError("Dashboard not found.", 404);
  if (!create) {
    assertDashboardOwner(existing, sub, "write", accessCtx);
  }

  const effectiveOwner = (!create && existing?.owner && existing.owner !== "anonymous") ? existing.owner : sub;
  const profile = await getUserProfile(db, effectiveOwner);
  if (body.namespace && body.namespace !== profile.namespace) {
    throw new PublishingError("Use the namespace saved in your user settings.");
  }
  const isPublic = body.isPublic ?? existing?.isPublic ?? false;
  const slug = body.slug ?? existing?.slug ?? (isPublic ? slugFromName(body.name || existing?.name || "") : "");
  if (isPublic && !profile.namespace) throw new PublishingError("Set a namespace in your user settings before publishing.");
  if (slug || isPublic) {
    const error = urlPartError(slug, "Dashboard URL");
    if (error) throw new PublishingError(error);
  }
  const { id: _id, owner: _owner, namespace: _namespace, created_at: _created, permissions: _perms, ...fields } = body;
  if (Array.isArray(fields.tags)) {
    fields.tags = fields.tags
      .map((t: unknown) => normalizeGroupName(String(t).split(":")[0] || ""))
      .filter(Boolean);
  } else if (create && !fields.tags) {
    fields.tags = [];
  }
  const now = new Date().toISOString();
  const data = {
    ...existing,
    ...fields,
    owner: effectiveOwner,
    isPublic,
    slug: slug || undefined,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  delete data.id;
  delete data.namespace;
  delete data.permissions;
  // Read the authoritative namespace in the same atomic statement as the write, so a
  // profile rename cannot leave a dashboard pointing at a stale namespace.
  const result = await db.query(`
    ${create ? "CREATE" : "UPDATE"} $id CONTENT object::extend($data, {
      namespace: (SELECT namespace FROM ONLY $profileId).namespace
    });
  `, { id: recordId, profileId: new RecordId("user_profile", effectiveOwner), data });
  const record = result.flat().find((item: any) => item?.id?.toString() === recordId.toString());
  if (!record) throw new Error("Dashboard could not be saved.");
  return { ...record, id: `dashboard:${dashboardId(id)}` };
}

export async function resolvePublicDashboard(db: PublishingDb, namespace: string, slug: string) {
  if (urlPartError(namespace, "Namespace") || urlPartError(slug, "Dashboard URL")) return null;
  const result = await db.query(
    "SELECT * FROM dashboard WHERE namespace = $namespace AND slug = $slug AND isPublic = true LIMIT 1",
    { namespace, slug },
  );
  const record = result[0]?.[0];
  return record ? { ...record, id: record.id.toString().replace(/[⟨⟩]/g, "") } : null;
}

export function publishingErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unable to save changes.";
  let status = error instanceof PublishingError ? error.status : 500;
  let friendly = message;
  if (/user_namespace/.test(message)) {
    status = 409;
    friendly = "That namespace is already taken. Choose another one.";
  } else if (/dashboard_public_url/.test(message)) {
    status = 409;
    friendly = "That dashboard URL is already used in this namespace. Choose another one.";
  }
  return Response.json({ success: false, error: friendly }, { status });
}
