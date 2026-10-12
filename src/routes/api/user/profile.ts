import type { APIEvent } from "@solidjs/start/server";
import { getAuthUser } from "~/lib/auth";
import { getDb } from "~/lib/db";
import { getUserProfile, saveUserNamespace, publishingErrorResponse } from "~/lib/dashboard/publishing";

export async function GET(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  try {
    return Response.json({ success: true, data: await getUserProfile(await getDb(), user.sub) });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}

export async function PUT(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  try {
    const body = await event.request.json();
    return Response.json({ success: true, data: await saveUserNamespace(await getDb(), user.sub, body.namespace) });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
