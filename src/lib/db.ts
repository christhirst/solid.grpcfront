import { Surreal } from "surrealdb";
import * as Sentry from "@sentry/node";
import { initWorkflowScheduler } from "./workflowScheduler";

// ---------------------------------------------------------------------------
// TracedDb — wraps every SurrealDB call with a Sentry span
// ---------------------------------------------------------------------------

const QUERY_MAX_LEN = 300; // max chars of query logged in span attributes

function truncate(s: string, max = QUERY_MAX_LEN): string {
    return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * Extract a human-readable table/resource name from a RecordId or string.
 * E.g. RecordId("workflow", "abc") → "workflow"
 */
function resourceName(thing: any): string {
    if (!thing) return "unknown";
    if (typeof thing === "string") return thing.split(":")[0];
    if (thing.tb) return String(thing.tb); // RecordId has a .tb property
    return String(thing);
}

/**
 * TracedDb wraps a Surreal instance and instruments every operation with
 * Sentry spans. All methods use `any` to avoid SurrealDB's complex generic
 * constraints — the runtime behaviour is identical.
 */
class TracedDb {
    private inner: Surreal;
    private dbLabel: string;

    constructor(inner: Surreal, label = "main") {
        this.inner = inner;
        this.dbLabel = label;
    }

    /** Forward .query() with a Sentry span */
    async query(surql: string, vars?: Record<string, unknown>): Promise<any> {
        console.log(`[DB] Executing query: ${truncate(surql, 100)}`);
        return Sentry.startSpan(
            {
                name: truncate(surql, 80),
                op: "db.query",
                attributes: {
                    "db.system": "surrealdb",
                    "db.name": this.dbLabel,
                    "db.statement": truncate(surql),
                },
            },
            async (span) => {
                try {
                    const result = await (this.inner as any).query(surql, vars);
                    // Try to add row count
                    if (Array.isArray(result)) {
                        const first = (result as any[])[0];
                        if (Array.isArray(first)) {
                            console.log(
                                `[DB] Query returned ${first.length} rows`,
                            );
                            span.setAttribute("db.row_count", first.length);
                        }
                    }
                    return result;
                } catch (err: any) {
                    console.error(`[DB] Query failed: ${err.message}`);
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .select() with a Sentry span */
    async select(thing: any): Promise<any> {
        const resource = resourceName(thing);
        return Sentry.startSpan(
            {
                name: `SELECT ${resource}`,
                op: "db.select",
                attributes: {
                    "db.system": "surrealdb",
                    "db.name": this.dbLabel,
                    "db.collection.name": resource,
                },
            },
            async (span) => {
                try {
                    const result = await (this.inner as any).select(thing);
                    if (Array.isArray(result)) {
                        span.setAttribute("db.row_count", result.length);
                    }
                    return result;
                } catch (err) {
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .create() with a Sentry span */
    async create(thing: any, data?: any): Promise<any> {
        const resource = resourceName(thing);
        return Sentry.startSpan(
            {
                name: `CREATE ${resource}`,
                op: "db.create",
                attributes: {
                    "db.system": "surrealdb",
                    "db.name": this.dbLabel,
                    "db.collection.name": resource,
                },
            },
            async () => {
                try {
                    return await (this.inner as any).create(thing, data);
                } catch (err) {
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .update() with a Sentry span */
    async update(thing: any, data?: any): Promise<any> {
        const resource = resourceName(thing);
        return Sentry.startSpan(
            {
                name: `UPDATE ${resource}`,
                op: "db.update",
                attributes: {
                    "db.system": "surrealdb",
                    "db.name": this.dbLabel,
                    "db.collection.name": resource,
                },
            },
            async () => {
                try {
                    return await (this.inner as any).update(thing, data);
                } catch (err) {
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .delete() with a Sentry span */
    async delete(thing: any): Promise<any> {
        const resource = resourceName(thing);
        return Sentry.startSpan(
            {
                name: `DELETE ${resource}`,
                op: "db.delete",
                attributes: {
                    "db.system": "surrealdb",
                    "db.name": this.dbLabel,
                    "db.collection.name": resource,
                },
            },
            async () => {
                try {
                    return await (this.inner as any).delete(thing);
                } catch (err) {
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .use() with a Sentry span */
    async use(opts: { namespace?: string; database?: string }): Promise<any> {
        return Sentry.startSpan(
            {
                name: `USE ${opts.namespace || ""}/${opts.database || ""}`,
                op: "db.use",
                attributes: {
                    "db.system": "surrealdb",
                    "db.namespace": opts.namespace || "",
                    "db.name": opts.database || "",
                },
            },
            async () => {
                try {
                    return await this.inner.use(opts);
                } catch (err) {
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }
}

// ---------------------------------------------------------------------------
// Connection management (unchanged caching logic, now with tracing)
// ---------------------------------------------------------------------------

// Cache the connection promise so concurrent requests await the same initial connection.
// We avoid globalThis as it can cause Nitro worker hangs when dealing with WebSockets/WASM.
let dbPromise: Promise<TracedDb> | null = null;
const dynamicDbs = new Map<string, Promise<TracedDb>>();

export async function getDb(): Promise<TracedDb> {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = Sentry.startSpan(
        {
            name: "SurrealDB Connect (main)",
            op: "db.connect",
            attributes: { "db.system": "surrealdb" },
        },
        async (connectSpan) => {
            // Define connection credentials. We fallback to local defaults for dev.
            const url = process.env.SURREALDB_URL || "";
            const user = process.env.SURREALDB_USER || "admin";
            const pass = process.env.SURREALDB_PASS || "";
            const namespace = process.env.SURREALDB_NS || "solidflow";
            const database = process.env.SURREALDB_DB || "main";

            connectSpan.setAttribute("db.url", url);
            connectSpan.setAttribute("db.namespace", namespace);
            connectSpan.setAttribute("db.name", database);

            console.log(`[DB] Connecting to SurrealDB at ${url}...`);

            try {
                const db = new Surreal();

                // Open a connection and authenticate
                await db.connect(url, {
                    authentication: {
                        username: user,
                        password: pass,
                    },
                });

                // Ensure namespace and database exist, then use them
                await db.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespace}`);
                await db.use({ namespace });
                await db.query(`DEFINE DATABASE IF NOT EXISTS ${database}`);
                await db.use({ namespace, database });

                console.log(
                    `[DB] Successfully connected to ${namespace}/${database}`,
                );

                // Initialize workflow scheduler ONCE on the server
                if (typeof window === "undefined") {
                    // Run in background so it doesn't block the first request
                    initWorkflowScheduler().catch((err) =>
                        console.error("Failed to init scheduler:", err),
                    );
                }

                return new TracedDb(db, database);
            } catch (err) {
                console.error("[DB] Failed to connect to SurrealDB:", err);
                Sentry.captureException(err);
                dbPromise = null;
                throw err;
            }
        },
    );

    return dbPromise;
}

export async function getDynamicDb(dbName: string): Promise<TracedDb> {
    if (dynamicDbs.has(dbName)) {
        return dynamicDbs.get(dbName)!;
    }

    const promise = Sentry.startSpan(
        {
            name: `SurrealDB Connect (${dbName})`,
            op: "db.connect",
            attributes: {
                "db.system": "surrealdb",
                "db.name": dbName,
            },
        },
        async (connectSpan) => {
            const url = process.env.SURREALDB_URL || "";
            const user = process.env.SURREALDB_USER || "admin";
            const pass = process.env.SURREALDB_PASS || "";
            const namespace = process.env.SURREALDB_NS || "solidflow";

            connectSpan.setAttribute("db.url", url);
            connectSpan.setAttribute("db.namespace", namespace);

            console.log(
                `[DB] Connecting to dynamic SurrealDB database '${dbName}'...`,
            );
            try {
                const s = new Surreal();
                await s.connect(url, {
                    authentication: { username: user, password: pass },
                });
                await s.use({ namespace, database: dbName });
                return new TracedDb(s, dbName);
            } catch (err) {
                console.error(
                    `[DB] Failed to connect to dynamic database ${dbName}:`,
                    err,
                );
                Sentry.captureException(err);
                dynamicDbs.delete(dbName);
                throw err;
            }
        },
    );

    dynamicDbs.set(dbName, promise);
    return promise;
}
