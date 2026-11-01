import type { APIEvent } from "@solidjs/start/server";
import { getAuthUser, getEffectiveAccessContext } from "~/lib/auth";
import { getDb } from "~/lib/db";
import {
  createNamespace,
  deleteNamespace,
  listNamespacesForUser,
  publishingErrorResponse,
  renameNamespace,
  transferNamespace,
} from "~/lib/dashboard/publishing";
import { readJsonBody } from "~/lib/requestUtils";

export async function GET(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const namespaces = await listNamespacesForUser(db, ctx);
    return Response.json({
      success: true,
      data: {
        namespaces,
      },
    });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}

export async function POST(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const body = await readJsonBody(event);
    const action = String(body.action || "create");

    let item: any = null;
    if (action === "create") {
      item = await createNamespace(db, ctx, {
        name: body.name,
        ownerType: body.ownerType === "group" ? "group" : "user",
        ownerGroup: body.ownerGroup,
      });
    } else if (action === "rename") {
      item = await renameNamespace(db, ctx, body.oldName || body.name, body.newName);
    } else if (action === "transfer") {
      item = await transferNamespace(db, ctx, body.name, {
        ownerType: body.ownerType === "group" ? "group" : "user",
        ownerSub: body.ownerSub,
        ownerGroup: body.ownerGroup,
      });
    } else if (action === "delete") {
      await deleteNamespace(db, ctx, body.name);
    } else {
      return Response.json(
        { success: false, error: `Unknown namespace action "${action}".` },
        { status: 400 }
      );
    }

    const namespaces = await listNamespacesForUser(db, ctx);
    const firstPub = namespaces.find((n) => n.canPublish);
    return Response.json({
      success: true,
      data: {
        item,
        namespaces,
        namespace: firstPub?.name || "",
      },
    });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
