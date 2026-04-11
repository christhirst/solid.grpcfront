import { APIEvent } from "solid-start/api";
import { getDb } from "~/lib/db";

export async function GET({ request }: APIEvent) {
  try {
    const db = await getDb();
    
    // INFO FOR NAMESPACE returns an object with a 'databases' property map
    const info = await db.query("INFO FOR NAMESPACE;");
    const databasesObj = (info[0] as any)?.databases || {};
    
    // the keys of the databases object are the database names
    const databases = Object.keys(databasesObj);
    
    return new Response(JSON.stringify({ success: true, data: databases }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST({ request }: APIEvent) {
  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Database name required" }), { status: 400 });
    }

    // Protect against basic injection, naming should be alphanumeric/underscores
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid database name" }), { status: 400 });
    }

    const db = await getDb();
    await db.query(`DEFINE DATABASE ${name};`);

    return new Response(JSON.stringify({ success: true, data: { name } }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
