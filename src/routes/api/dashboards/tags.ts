import type { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";

export async function GET(_event: APIEvent) {
  try {
    const db = await getDb();
    let contentTags: string[] = [];
    try {
      const res = await db.query(`SELECT content_tags FROM dashboard;`);
      const rows = Array.isArray(res) ? (Array.isArray(res[0]) ? res[0] : res) : [];
      const tagSet = new Set<string>();
      for (const r of rows) {
        if (Array.isArray(r?.content_tags)) {
          for (const t of r.content_tags) {
            const clean = String(t || "").trim();
            if (clean) tagSet.add(clean);
          }
        }
      }
      contentTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    return Response.json({ success: true, data: contentTags });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message || "Failed to load tags" }, { status: 500 });
  }
}
