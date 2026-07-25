import { Surreal } from "surrealdb";
import * as Sentry from "@sentry/node";
import { initWorkflowScheduler } from "./workflowScheduler";
import { logger } from "./logger";

const console = {
    log: (...args: any[]) => logger.info(...args),
    error: (...args: any[]) => logger.error(...args),
    warn: (...args: any[]) => logger.warn(...args),
};

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
        console.log(`[DB] SELECT ${resource}`);
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
                        console.log(`[DB] SELECT ${resource} returned ${result.length} rows`);
                        span.setAttribute("db.row_count", result.length);
                    }
                    return result;
                } catch (err: any) {
                    console.error(`[DB] SELECT ${resource} failed: ${err.message}`);
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .create() with a Sentry span */
    async create(thing: any, data?: any): Promise<any> {
        const resource = resourceName(thing);
        console.log(`[DB] CREATE ${resource}`);
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
                    const res = await (this.inner as any).create(thing, data);
                    console.log(`[DB] CREATE ${resource} successful`);
                    return res;
                } catch (err: any) {
                    console.error(`[DB] CREATE ${resource} failed: ${err.message}`);
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .update() with a Sentry span */
    async update(thing: any, data?: any): Promise<any> {
        const resource = resourceName(thing);
        console.log(`[DB] UPDATE ${resource}`);
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
                    const res = await (this.inner as any).update(thing, data);
                    console.log(`[DB] UPDATE ${resource} successful`);
                    return res;
                } catch (err: any) {
                    console.error(`[DB] UPDATE ${resource} failed: ${err.message}`);
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .delete() with a Sentry span */
    async delete(thing: any): Promise<any> {
        const resource = resourceName(thing);
        console.log(`[DB] DELETE ${resource}`);
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
                    const res = await (this.inner as any).delete(thing);
                    console.log(`[DB] DELETE ${resource} successful`);
                    return res;
                } catch (err: any) {
                    console.error(`[DB] DELETE ${resource} failed: ${err.message}`);
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .use() with a Sentry span */
    async use(opts: { namespace?: string; database?: string }): Promise<any> {
        console.log(`[DB] USE NS:${opts.namespace} DB:${opts.database}`);
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
                } catch (err: any) {
                    console.error(`[DB] USE failed: ${err.message}`);
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .live() with a Sentry span */
    async live(table: string, callback?: (action: string, result: any) => void): Promise<string> {
        console.log(`[DB] LIVE ${table}`);
        return Sentry.startSpan(
            {
                name: `LIVE ${table}`,
                op: "db.live",
                attributes: {
                    "db.system": "surrealdb",
                    "db.name": this.dbLabel,
                    "db.collection.name": table,
                },
            },
            async () => {
                try {
                    const queryUuid = await (this.inner as any).live(table, callback);
                    console.log(`[DB] LIVE ${table} started with UUID ${queryUuid}`);
                    return queryUuid;
                } catch (err: any) {
                    console.error(`[DB] LIVE ${table} failed: ${err.message}`);
                    Sentry.captureException(err);
                    throw err;
                }
            },
        );
    }

    /** Forward .subscribeLive() or .listenLive() */
    async subscribeLive(queryUuid: string, callback: (action: string, result: any) => void): Promise<void> {
        if (typeof (this.inner as any).subscribeLive === "function") {
            await (this.inner as any).subscribeLive(queryUuid, callback);
        } else if (typeof (this.inner as any).listenLive === "function") {
            await (this.inner as any).listenLive(queryUuid, callback);
        }
    }

    /** Forward .kill() to terminate a live query */
    async kill(queryUuid: string): Promise<void> {
        console.log(`[DB] KILL LIVE ${queryUuid}`);
        try {
            await (this.inner as any).kill(queryUuid);
        } catch (err: any) {
            console.error(`[DB] KILL LIVE ${queryUuid} failed: ${err.message}`);
        }
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

            console.log(`[DB] [INIT] Connecting to SurrealDB at ${url}...`);

            try {
                const db = new Surreal();

                // Open a connection and authenticate
                console.log(`[DB] [INIT] Authenticating as user: ${user}`);
                await db.connect(url, {
                    authentication: {
                        username: user,
                        password: pass,
                    },
                });

                // Ensure namespace and database exist, then use them
                console.log(`[DB] [INIT] Ensuring namespace exists: ${namespace}`);
                await db.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespace}`);
                await db.use({ namespace });
                
                console.log(`[DB] [INIT] Ensuring database exists: ${database}`);
                await db.query(`DEFINE DATABASE IF NOT EXISTS ${database}`);
                await db.use({ namespace, database });

                console.log(
                    `[DB] [INIT] Successfully connected to ${namespace}/${database}`,
                );

                // Initialize workflow scheduler ONCE on the server
                if (typeof window === "undefined") {
                    console.log("[DB] [INIT] Initializing workflow scheduler...");
                    // Run in background so it doesn't block the first request
                    initWorkflowScheduler().catch((err) =>
                        console.error("[DB] [INIT] Failed to init scheduler:", err),
                    );
                }

                return new TracedDb(db, database);
            } catch (err: any) {
                console.error("[DB] [INIT] Failed to connect to SurrealDB:", err.message);
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
                `[DB] [DYNAMIC] Connecting to dynamic database '${dbName}' at ${url}...`,
            );
            try {
                const s = new Surreal();
                await s.connect(url, {
                    authentication: { username: user, password: pass },
                });
                await s.use({ namespace, database: dbName });
                console.log(`[DB] [DYNAMIC] Successfully connected to '${dbName}'`);
                return new TracedDb(s, dbName);
            } catch (err: any) {
                console.error(
                    `[DB] [DYNAMIC] Failed to connect to dynamic database ${dbName}:`,
                    err.message,
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

const customDbs = new Map<string, Promise<TracedDb>>();

export interface CustomDbOpts {
    url?: string;
    user?: string;
    pass?: string;
    namespace?: string;
    database?: string;
}

export async function getCustomDb(opts: CustomDbOpts): Promise<TracedDb> {
    const url = opts.url || process.env.SURREALDB_URL || "";
    const user = opts.user || process.env.SURREALDB_USER || "admin";
    const pass = opts.pass || process.env.SURREALDB_PASS || "";
    const namespace = opts.namespace || process.env.SURREALDB_NS || "solidflow";
    const database = opts.database || "main";

    const cacheKey = `${url}|${user}|${pass}|${namespace}|${database}`;

    if (customDbs.has(cacheKey)) {
        return customDbs.get(cacheKey)!;
    }

    const promise = Sentry.startSpan(
        {
            name: `SurrealDB Connect (custom: ${database})`,
            op: "db.connect",
            attributes: {
                "db.system": "surrealdb",
                "db.name": database,
            },
        },
        async (connectSpan) => {
            connectSpan.setAttribute("db.url", url);
            connectSpan.setAttribute("db.namespace", namespace);

            console.log(
                `[DB] [CUSTOM] Connecting to custom database '${database}' at ${url}...`,
            );
            try {
                const s = new Surreal();
                await s.connect(url, {
                    authentication: { username: user, password: pass },
                });
                
                try {
                    await s.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespace}`);
                } catch (e: any) {
                    console.log(`[DB] [CUSTOM] Could not define namespace (possibly insufficient permissions): ${e.message}`);
                }
                await s.use({ namespace });

                try {
                    await s.query(`DEFINE DATABASE IF NOT EXISTS ${database}`);
                } catch (e: any) {
                    console.log(`[DB] [CUSTOM] Could not define database (possibly insufficient permissions): ${e.message}`);
                }
                await s.use({ namespace, database });
                
                console.log(`[DB] [CUSTOM] Successfully connected to '${database}'`);
                return new TracedDb(s, database);
            } catch (err: any) {
                console.error(
                    `[DB] [CUSTOM] Failed to connect to custom database ${database}:`,
                    err.message,
                );
                Sentry.captureException(err);
                customDbs.delete(cacheKey);
                throw err;
            }
        },
    );

    customDbs.set(cacheKey, promise);
    return promise;
}

