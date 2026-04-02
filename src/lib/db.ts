import { Surreal } from "surrealdb";
import { initWorkflowScheduler } from "./workflowScheduler";

// Cache the connection promise so concurrent requests await the same initial connection.
// We avoid globalThis as it can cause Nitro worker hangs when dealing with WebSockets/WASM.
let dbPromise: Promise<Surreal> | null = null;

export async function getDb(): Promise<Surreal> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    // Define connection credentials. We fallback to local defaults for dev.
    const url = process.env.SURREALDB_URL || "";
    const user = process.env.SURREALDB_USER || "admin";
    const pass = process.env.SURREALDB_PASS || "";
    const namespace = process.env.SURREALDB_NS || "solidflow";
    const database = process.env.SURREALDB_DB || "main";

    console.log(`[DB] Connecting to SurrealDB at ${url}...`);

    try {
      const db = new Surreal();

      // Open a connection and authenticate
      await db.connect(url, {
        authentication: {
          username: user,
          password: pass,
        }
      });

      // Ensure namespace and database exist, then use them
      await db.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespace}`);
      await db.use({ namespace });
      await db.query(`DEFINE DATABASE IF NOT EXISTS ${database}`);
      await db.use({ namespace, database });

      console.log(`[DB] Successfully connected to ${namespace}/${database}`);

      // Initialize workflow scheduler ONCE on the server
      if (typeof window === "undefined") {
        // Run in background so it doesn't block the first request
        initWorkflowScheduler().catch(err => console.error("Failed to init scheduler:", err));
      }

      return db;
    } catch (err) {
      console.error("[DB] Failed to connect to SurrealDB:", err);
      dbPromise = null;
      throw err;
    }
  })();

  return dbPromise;
}
