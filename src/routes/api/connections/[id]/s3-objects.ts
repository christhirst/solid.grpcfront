import type { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getDb } from "~/lib/db";
import { normalizeConnection, getCaCertContent } from "~/lib/connections";
import { listS3Objects } from "~/lib/s3Executor";
import { readJsonBody } from "~/lib/requestUtils";

export async function POST(event: APIEvent) {
  try {
    const rawParamId = event.params.id || "";
    const id = rawParamId.replace(/^connection:/, "").replace(/[⟨⟩]/g, "").trim();

    let body: any = null;
    try {
      body = await readJsonBody(event);
    } catch {
      // Body is optional if connection already exists in DB
    }

    let rawConnection: any = null;
    if (id && id !== "adhoc" && id !== "draft" && id !== "new" && id !== "custom") {
      try {
        const db = await getDb();
        const result = await db.select(new RecordId("connection", id));
        const dbConn = Array.isArray(result) ? result[0] : result;
        if (dbConn) {
          rawConnection = {
            ...dbConn,
            ...(body || {}),
            // Preserve DB credentials/bucket unless explicitly overridden with non-empty values
            endpoint: body?.endpoint || dbConn.endpoint || dbConn.url,
            bucket: body?.bucket || dbConn.bucket,
            region: body?.region || dbConn.region,
            accessKeyId: body?.accessKeyId !== undefined && body?.accessKeyId !== "" ? body.accessKeyId : dbConn.accessKeyId,
            secretAccessKey: body?.secretAccessKey !== undefined && body?.secretAccessKey !== "" ? body.secretAccessKey : dbConn.secretAccessKey,
            sessionToken: body?.sessionToken !== undefined && body?.sessionToken !== "" ? body.sessionToken : dbConn.sessionToken,
            prefix: body?.prefix !== undefined ? body.prefix : dbConn.prefix,
            type: "s3",
          };
        }
      } catch {
        // Fallback to body below
      }
    }

    if (!rawConnection && body && (body.bucket || body.endpoint || body.type === "s3")) {
      rawConnection = { ...body, type: "s3" };
    }

    if (!rawConnection) {
      return Response.json({ success: false, error: "S3 connection configuration not found" }, { status: 404 });
    }

    const connection = normalizeConnection(rawConnection) as any;
    if (connection.type !== "s3") {
      return Response.json({ success: false, error: "An S3 connection is required" }, { status: 400 });
    }
    if (!connection.bucket) {
      return Response.json({ success: false, error: "S3 Bucket Name is required" }, { status: 400 });
    }

    const caCert = await getCaCertContent(connection.caId);

    const res = await listS3Objects({
      endpoint: connection.endpoint || "https://s3.amazonaws.com",
      region: connection.region || "us-east-1",
      bucket: connection.bucket,
      accessKeyId: connection.accessKeyId,
      secretAccessKey: connection.secretAccessKey,
      sessionToken: connection.sessionToken,
      prefix: body?.prefix !== undefined ? body.prefix : connection.prefix,
      pattern: body?.pattern,
      maxKeys: body?.maxKeys || 250,
      forcePathStyle: connection.forcePathStyle !== undefined ? Boolean(connection.forcePathStyle) : true,
      caCert,
      acceptInvalidCert: Boolean(connection.acceptInvalidCert || connection.caId === "accept_all"),
    });

    if (!res.success) {
      return Response.json({ success: false, error: res.error || "Failed to list S3 objects" }, { status: 502 });
    }

    return Response.json({ success: true, data: res });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message || "Failed to list S3 objects" }, { status: 502 });
  }
}
