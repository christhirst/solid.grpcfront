import { RecordId } from "surrealdb";
import { slugFromName, urlPartError } from "./publicUrl";
import { dashboardId } from "./boardTypes";
import {
   buildAccessContext,
  canAccessObject,
  canManageNamespace,
  canPublishToNamespace,
  categoryAccess,
  isGroupManager,
  isGroupMember,
  normalizeGroupName,
  normalizeTagList,
  type EffectiveAccessContext,
  type GroupRight,
  type PublishNamespaceRecord,
} from "~/lib/groupAuth";

// Structural interface also permits testing against an isolated SurrealDB instance.
interface PublishingDb {
  query: (sql: string, vars?: Record<string, any>) => Promise<any>;
  select: (id: any) => Promise<any>;
}

export class PublishingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface PublishNamespaceItem extends PublishNamespaceRecord {
  id: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  canPublish: boolean;
  canManage: boolean;
  dashboardCount: number;
}

const schemas = new WeakMap<PublishingDb, Promise<void>>();
export async function ensurePublishingSchema(db: PublishingDb): Promise<void> {
  let pending = schemas.get(db);
  if (!pending) {
    pending = db
      .query(`
      DEFINE TABLE IF NOT EXISTS user_profile TYPE NORMAL SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS dashboard TYPE NORMAL SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS group_namespace TYPE NORMAL SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS group_member TYPE NORMAL SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS publish_namespace TYPE NORMAL SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS user_namespace ON user_profile FIELDS namespace UNIQUE;
      DEFINE INDEX IF NOT EXISTS publish_namespace_name ON publish_namespace FIELDS name UNIQUE;
      DEFINE INDEX IF NOT EXISTS dashboard_public_url ON dashboard FIELDS namespace, slug UNIQUE;
      DEFINE INDEX IF NOT EXISTS group_member_idx ON group_member FIELDS group, username UNIQUE;
    `)
      .then(() => {})
      .catch((err: unknown) => {
        schemas.delete(db);
        throw err;
      });
    schemas.set(db, pending);
  }
  await pending;
}

export const firstRecord = (result: any) => (Array.isArray(result) ? result[0] : result);

const unpackQueryRows = (res: any): any[] => {
  if (!Array.isArray(res)) return [];
  return Array.isArray(res[0]) ? res[0] : res;
};

/**
 * Lazy, idempotent migration: ensure every `user_profile.namespace` has a corresponding
 * `publish_namespace` record owned by that user.
 */
export async function migrateUserNamespaces(db: PublishingDb): Promise<void> {
  await ensurePublishingSchema(db);
  try {
    const profRes = await db.query(
      `SELECT sub, id, namespace FROM user_profile WHERE namespace != NONE AND namespace != '';`
    );
    const profiles = unpackQueryRows(profRes);
    for (const p of profiles) {
      const ns = typeof p?.namespace === "string" ? p.namespace.trim().toLowerCase() : "";
      if (!ns) continue;
      const rawId = p?.sub || ( p?.id ? String(p.id).replace(/^user_profile:/, "").replace(/[⟨⟩]/g, "") : "" );
      if (!rawId) continue;
      const nsRecordId = new RecordId("publish_namespace", ns);
      const existing = firstRecord(await db.select(nsRecordId).catch(() => null));
      if (!existing) {
        const now = new Date().toISOString();
        await db
          .query(
            `CREATE $id CONTENT {
              name: $name,
              ownerType: 'user',
              ownerSub: $ownerSub,
              ownerGroup: NONE,
              created_by: $ownerSub,
              created_at: $now,
              updated_at: $now
            };`,
            { id: nsRecordId, name: ns, ownerSub: rawId, now }
          )
          .catch(() => {});
      }
    }
  } catch {
    // Ignore if user_profile is empty
  }
}

export async function getNamespaceRecord(
  db: PublishingDb,
  name: string
): Promise<PublishNamespaceRecord | null> {
  const clean = (name || "").trim().toLowerCase();
  if (!clean) return null;
  await migrateUserNamespaces(db);
  try {
    const rec = firstRecord(await db.select(new RecordId("publish_namespace", clean)));
    if (rec && rec.name) {
      return {
        name: String(rec.name),
        ownerType: rec.ownerType === "group" ? "group" : "user",
        ownerSub: rec.ownerSub || null,
        ownerGroup: rec.ownerGroup || null,
      };
    }
  } catch {}
  return null;
}

export async function listNamespacesForUser(
  db: PublishingDb,
  ctx: EffectiveAccessContext
): Promise<PublishNamespaceItem[]> {
  await migrateUserNamespaces(db);

  const [nsRes, countRes] = await Promise.all([
    db.query(`SELECT * FROM publish_namespace ORDER BY name ASC;`).catch(() => []),
    db
      .query(
        `SELECT namespace, count() AS total FROM dashboard WHERE namespace != NONE AND isPublic = true GROUP BY namespace;`
      )
      .catch(() => []),
  ]);

  const rows = unpackQueryRows(nsRes);
  const countRows = unpackQueryRows(countRes);
  const countMap = new Map<string, number>();
  for (const c of countRows) {
    if (c?.namespace) {
      countMap.set(String(c.namespace), Number(c.total || 0));
    }
  }

  const items: PublishNamespaceItem[] = [];
  for (const r of rows) {
    if (!r?.name) continue;
    const nsRec: PublishNamespaceRecord = {
      name: String(r.name),
      ownerType: r.ownerType === "group" ? "group" : "user",
      ownerSub: r.ownerSub || null,
      ownerGroup: r.ownerGroup || null,
    };
    const canPub = canPublishToNamespace(ctx, nsRec);
    const canMgr = canManageNamespace(ctx, nsRec);
    if (canPub || canMgr || ctx.isAdmin) {
      items.push({
        ...nsRec,
        id: `publish_namespace:${nsRec.name}`,
        created_by: r.created_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        canPublish: canPub,
        canManage: canMgr,
        dashboardCount: countMap.get(nsRec.name) || 0,
      });
    }
  }
  return items;
}

export async function createNamespace(
  db: PublishingDb,
  ctx: EffectiveAccessContext,
  params: {
    name: unknown;
    ownerType?: "user" | "group";
    ownerGroup?: string;
  }
): Promise<PublishNamespaceItem> {
  if (!ctx.sub || ctx.sub === "anonymous") {
    throw new PublishingError("Please log in.", 401);
  }
  if (!categoryAccess(ctx.platformRole, "dashboard").canEdit && !ctx.isAdmin) {
    throw new PublishingError("Your platform role (viewer) cannot create publish namespaces.", 403);
  }

  const cleanName = typeof params.name === "string" ? params.name.trim().toLowerCase() : params.name;
  const error = urlPartError(cleanName, "Namespace");
  if (error) throw new PublishingError(error, 400);
  const nameStr = cleanName as string;

  const ownerType = params.ownerType === "group" ? "group" : "user";
  let ownerGroup: string | null = null;
  let ownerSub: string | null = null;

  if (ownerType === "group") {
    ownerGroup = normalizeGroupName(params.ownerGroup || "");
    if (!ownerGroup) {
      throw new PublishingError("Select a group to own this namespace.", 400);
    }
    if (!isGroupManager(ctx, ownerGroup)) {
      throw new PublishingError(
        `You must be a manager of group "${ownerGroup}" to create a namespace owned by it.`,
        403
      );
    }
  } else {
    ownerSub = ctx.sub;
  }

  await migrateUserNamespaces(db);
  const existing = await getNamespaceRecord(db, nameStr);
  if (existing) {
    throw new PublishingError("user_namespace: That namespace is already taken. Choose another one.", 409);
  }

  const now = new Date().toISOString();
  const nsId = new RecordId("publish_namespace", nameStr);
  await db.query(
    `CREATE $id CONTENT {
      name: $name,
      ownerType: $ownerType,
      ownerSub: $ownerSub,
      ownerGroup: $ownerGroup,
      created_by: $createdBy,
      created_at: $now,
      updated_at: $now
    };`,
    {
      id: nsId,
      name: nameStr,
      ownerType,
      ownerSub,
      ownerGroup,
      createdBy: ctx.sub,
      now,
    }
  );

  // If user-owned and user_profile has no default namespace yet, sync it for backwards compatibility
  if (ownerType === "user") {
    const prof = firstRecord(await db.select(new RecordId("user_profile", ctx.sub)).catch(() => null));
    if (!prof?.namespace) {
      await db
        .query(`UPSERT $profile MERGE { namespace: $namespace, updated_at: $now };`, {
          profile: new RecordId("user_profile", ctx.sub),
          namespace: nameStr,
          now,
        })
        .catch(() => {});
    }
  }

  return {
    id: `publish_namespace:${nameStr}`,
    name: nameStr,
    ownerType,
    ownerSub,
    ownerGroup,
    created_by: ctx.sub,
    created_at: now,
    updated_at: now,
    canPublish: true,
    canManage: true,
    dashboardCount: 0,
  };
}

export async function renameNamespace(
  db: PublishingDb,
  ctx: EffectiveAccessContext,
  oldNameRaw: unknown,
  newNameRaw: unknown
): Promise<PublishNamespaceItem> {
  const oldName = typeof oldNameRaw === "string" ? oldNameRaw.trim().toLowerCase() : "";
  const newName = typeof newNameRaw === "string" ? newNameRaw.trim().toLowerCase() : newNameRaw;

  if (!oldName) throw new PublishingError("Current namespace name is required.", 400);
  const error = urlPartError(newName, "Namespace");
  if (error) throw new PublishingError(error, 400);
  const newNameStr = newName as string;

  await migrateUserNamespaces(db);
  const existing = await getNamespaceRecord(db, oldName);
  if (!existing) {
    throw new PublishingError(`Namespace "${oldName}" was not found.`, 404);
  }
  if (!canManageNamespace(ctx, existing)) {
    throw new PublishingError(`You do not have permission to rename namespace "${oldName}".`, 403);
  }

  if (oldName === newNameStr) {
    const list = await listNamespacesForUser(db, ctx);
    return list.find((i) => i.name === oldName)!;
  }

  const conflict = await getNamespaceRecord(db, newNameStr);
  if (conflict) {
    throw new PublishingError("user_namespace: That namespace is already taken. Choose another one.", 409);
  }

  const now = new Date().toISOString();
  await db.query(
    `
    BEGIN TRANSACTION;
    CREATE $newId CONTENT {
      name: $newName,
      ownerType: $ownerType,
      ownerSub: $ownerSub,
      ownerGroup: $ownerGroup,
      created_by: $createdBy,
      created_at: $now,
      updated_at: $now
    };
    DELETE $oldId;
    UPDATE dashboard SET namespace = $newName, updated_at = $now WHERE namespace = $oldName;
    UPDATE user_profile SET namespace = $newName, updated_at = $now WHERE namespace = $oldName;
    COMMIT TRANSACTION;
  `,
    {
      oldId: new RecordId("publish_namespace", oldName),
      newId: new RecordId("publish_namespace", newNameStr),
      oldName,
      newName: newNameStr,
      ownerType: existing.ownerType,
      ownerSub: existing.ownerSub || null,
      ownerGroup: existing.ownerGroup || null,
      createdBy: ctx.sub,
      now,
    }
  );

  const list = await listNamespacesForUser(db, ctx);
  return (
    list.find((i) => i.name === newNameStr) || {
      id: `publish_namespace:${newNameStr}`,
      name: newNameStr,
      ownerType: existing.ownerType,
      ownerSub: existing.ownerSub,
      ownerGroup: existing.ownerGroup,
      canPublish: true,
      canManage: true,
      dashboardCount: 0,
    }
  );
}

export async function transferNamespace(
  db: PublishingDb,
  ctx: EffectiveAccessContext,
  nameRaw: unknown,
  target: { ownerType: "user" | "group"; ownerSub?: string; ownerGroup?: string }
): Promise<PublishNamespaceItem> {
  const name = typeof nameRaw === "string" ? nameRaw.trim().toLowerCase() : "";
  if (!name) throw new PublishingError("Namespace name is required.", 400);

  await migrateUserNamespaces(db);
  const existing = await getNamespaceRecord(db, name);
  if (!existing) {
    throw new PublishingError(`Namespace "${name}" was not found.`, 404);
  }
  if (!canManageNamespace(ctx, existing)) {
    throw new PublishingError(`You do not have permission to transfer namespace "${name}".`, 403);
  }

  const nextOwnerType = target.ownerType === "group" ? "group" : "user";
  let nextOwnerSub: string | null = null;
  let nextOwnerGroup: string | null = null;

  if (nextOwnerType === "group") {
    nextOwnerGroup = normalizeGroupName(target.ownerGroup || "");
    if (!nextOwnerGroup) {
      throw new PublishingError("Target group is required.", 400);
    }
    if (!isGroupMember(ctx, nextOwnerGroup) && !ctx.isAdmin) {
      throw new PublishingError(`You must be a member of "${nextOwnerGroup}" to transfer a namespace to it.`, 403);
    }
  } else {
    nextOwnerSub = (target.ownerSub || ctx.sub).trim();
  }

  const now = new Date().toISOString();
  await db.query(
    `UPSERT $id MERGE {
      ownerType: $ownerType,
      ownerSub: $ownerSub,
      ownerGroup: $ownerGroup,
      updated_at: $now
    };`,
    {
      id: new RecordId("publish_namespace", name),
      ownerType: nextOwnerType,
      ownerSub: nextOwnerSub,
      ownerGroup: nextOwnerGroup,
      now,
    }
  );

  const list = await listNamespacesForUser(db, ctx);
  return (
    list.find((i) => i.name === name) || {
      id: `publish_namespace:${name}`,
      name,
      ownerType: nextOwnerType,
      ownerSub: nextOwnerSub,
      ownerGroup: nextOwnerGroup,
      canPublish: true,
      canManage: true,
      dashboardCount: 0,
    }
  );
}

export async function deleteNamespace(
  db: PublishingDb,
  ctx: EffectiveAccessContext,
  nameRaw: unknown
): Promise<void> {
  const name = typeof nameRaw === "string" ? nameRaw.trim().toLowerCase() : "";
  if (!name) throw new PublishingError("Namespace name is required.", 400);

  await migrateUserNamespaces(db);
  const existing = await getNamespaceRecord(db, name);
  if (!existing) {
    throw new PublishingError(`Namespace "${name}" was not found.`, 404);
  }
  if (!canManageNamespace(ctx, existing)) {
    throw new PublishingError(`You do not have permission to delete namespace "${name}".`, 403);
  }

  const pubRes = await db.query(
    `SELECT name, slug FROM dashboard WHERE namespace = $name AND isPublic = true;`,
    { name }
  );
  const pubDashboards = unpackQueryRows(pubRes);
  if (pubDashboards.length > 0) {
    const names = pubDashboards.map((d: any) => d.name || d.slug || "untitled").join(", ");
    throw new PublishingError(
      `Cannot delete namespace "${name}" while published dashboards use it (${names}). Unpublish or move them first.`,
      400
    );
  }

  const now = new Date().toISOString();
  await db.query(
    `
    BEGIN TRANSACTION;
    DELETE $id;
    UPDATE dashboard SET namespace = NONE, updated_at = $now WHERE namespace = $name;
    UPDATE user_profile SET namespace = NONE, updated_at = $now WHERE namespace = $name;
    COMMIT TRANSACTION;
  `,
    { id: new RecordId("publish_namespace", name), name, now }
  );
}

export async function getUserProfile(db: PublishingDb, sub: string) {
  await migrateUserNamespaces(db);
  const record = firstRecord(await db.select(new RecordId("user_profile", sub)));
  if (record?.namespace) {
    return { namespace: String(record.namespace) };
  }
  // Fallback to first user-owned namespace in publish_namespace
  const nsRes = await db
    .query(`SELECT name FROM publish_namespace WHERE ownerType = 'user' AND ownerSub = $sub ORDER BY created_at ASC LIMIT 1;`, {
      sub,
    })
    .catch(() => []);
  const rows = unpackQueryRows(nsRes);
  return { namespace: rows[0]?.name ? String(rows[0].name) : "" };
}

/**
 * Legacy helper preserved for backward-compatibility and integration tests.
 * Creates a user-owned namespace if the user has none, or renames the user's primary namespace.
 */
export async function saveUserNamespace(db: PublishingDb, sub: string, namespace: unknown) {
  const error = urlPartError(namespace, "Namespace");
  if (error) throw new PublishingError(error);
  const targetNs = (namespace as string).trim().toLowerCase();
  await migrateUserNamespaces(db);

  const ctx = buildAccessContext({ sub, idpRole: "creator" });
  const current = await getUserProfile(db, sub);
  if (current.namespace && current.namespace !== targetNs) {
    await renameNamespace(db, ctx, current.namespace, targetNs);
  } else if (!current.namespace) {
    await createNamespace(db, ctx, { name: targetNs, ownerType: "user" });
  }
  await db
    .query(`UPSERT $profile MERGE { namespace: $namespace, updated_at: $now };`, {
      profile: new RecordId("user_profile", sub),
      namespace: targetNs,
      now: new Date().toISOString(),
    })
    .catch(() => {});
  return { namespace: targetNs };
}

export function assertDashboardOwner(
  record: any,
  sub: string,
  requiredRight: GroupRight = "write",
  accessCtx?: EffectiveAccessContext
) {
  if (accessCtx) {
    if (!canAccessObject(accessCtx, record, "dashboard", requiredRight)) {
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PublishingError("Invalid dashboard data.");
  }
  if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") {
    throw new PublishingError("Published must be true or false.");
  }
  if (body.slug !== undefined && typeof body.slug !== "string") {
    throw new PublishingError("Dashboard URL must be text.");
  }
  await migrateUserNamespaces(db);
  const recordId = new RecordId("dashboard", dashboardId(id));
  const existing = create ? undefined : firstRecord(await db.select(recordId));
  if (!create && !existing) throw new PublishingError("Dashboard not found.", 404);
  if (!create) {
    assertDashboardOwner(existing, sub, "write", accessCtx);
  }

  const effectiveOwner =
    !create && existing?.owner && existing.owner !== "anonymous" ? existing.owner : sub;
  const effectiveCtx =
    accessCtx || buildAccessContext({ sub: effectiveOwner, idpRole: "creator" });

  // Resolve target namespace
  const requestedNs =
    typeof body.namespace === "string" ? body.namespace.trim().toLowerCase() : undefined;
  let chosenNamespace: string | undefined;

  if (requestedNs) {
    const nsErr = urlPartError(requestedNs, "Namespace");
    if (nsErr) throw new PublishingError(nsErr, 400);
    const nsRec = await getNamespaceRecord(db, requestedNs);
    const isUnchangedExisting = !create && existing?.namespace === requestedNs;
    if (!nsRec || (!isUnchangedExisting && !canPublishToNamespace(effectiveCtx, nsRec))) {
      throw new PublishingError(
        "Use a namespace saved in your user settings or owned by one of your groups.",
        403
      );
    }
    chosenNamespace = requestedNs;
  } else if (!create && existing?.namespace) {
    chosenNamespace = String(existing.namespace);
  } else {
    const profile = await getUserProfile(db, effectiveOwner);
    if (profile.namespace) {
      chosenNamespace = profile.namespace;
    } else {
      const available = await listNamespacesForUser(db, effectiveCtx);
      const firstPub = available.find((n) => n.canPublish);
      if (firstPub) chosenNamespace = firstPub.name;
    }
  }

  const isPublic = body.isPublic ?? existing?.isPublic ?? false;
  const slug =
    body.slug ??
    existing?.slug ??
    (isPublic ? slugFromName(body.name || existing?.name || "") : "");
  if (isPublic && !chosenNamespace) {
    throw new PublishingError("Set a namespace in your user settings before publishing.");
  }
  if (slug || isPublic) {
    const error = urlPartError(slug, "Dashboard URL");
    if (error) throw new PublishingError(error);
  }

  const {
    id: _id,
    owner: _owner,
    namespace: _namespace,
    created_at: _created,
    permissions: _perms,
    tags: bodyTags,
    content_tags: bodyContentTags,
    ...fields
  } = body;

  // Tags are managed via the tile checklist (PATCH); on create we accept initial tags if supplied,
  // and on update we preserve existing tags so stale editor state cannot overwrite tile changes.
  const resolvedTags = create
    ? normalizeTagList(bodyTags)
    : Array.isArray(existing?.tags)
      ? normalizeTagList(existing.tags)
      : normalizeTagList(bodyTags);

  const resolvedContentTags = Array.isArray(bodyContentTags)
    ? bodyContentTags
        .map((t: any) => String(t || "").trim())
        .filter((t: string) => t.length > 0)
        .filter((t: string, idx: number, arr: string[]) => arr.indexOf(t) === idx)
    : Array.isArray(existing?.content_tags)
      ? existing.content_tags
      : [];

  const now = new Date().toISOString();
  const data: Record<string, any> = {
    ...existing,
    ...fields,
    tags: resolvedTags,
    content_tags: resolvedContentTags,
    owner: effectiveOwner,
    namespace: chosenNamespace || undefined,
    isPublic,
    slug: slug || undefined,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  delete data.id;
  delete data.permissions;

  const result = await db.query(
    `${create ? "CREATE" : "UPDATE"} $id CONTENT $data;`,
    { id: recordId, data }
  );
  const record = result.flat().find((item: any) => item?.id?.toString() === recordId.toString());
  if (!record) throw new Error("Dashboard could not be saved.");
  return { ...record, id: `dashboard:${dashboardId(id)}` };
}

export async function resolvePublicDashboard(db: PublishingDb, namespace: string, slug: string) {
  if (urlPartError(namespace, "Namespace") || urlPartError(slug, "Dashboard URL")) return null;
  const result = await db.query(
    "SELECT * FROM dashboard WHERE namespace = $namespace AND slug = $slug AND isPublic = true LIMIT 1",
    { namespace, slug }
  );
  const record = result[0]?.[0];
  return record ? { ...record, id: record.id.toString().replace(/[⟨⟩]/g, "") } : null;
}

export function publishingErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unable to save changes.";
  let status = error instanceof PublishingError ? error.status : 500;
  let friendly = message;
  if (/user_namespace|publish_namespace_name/.test(message)) {
    status = 409;
    friendly = "That namespace is already taken. Choose another one.";
  } else if (/dashboard_public_url/.test(message)) {
    status = 409;
    friendly = "That dashboard URL is already used in this namespace. Choose another one.";
  }
  return Response.json({ success: false, error: friendly }, { status });
}
