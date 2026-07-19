import { Surreal, RecordId } from "surrealdb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { runWorkflowBackground } from "../src/lib/workflowEngine";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTest() {
    const url = process.env.SURREALDB_URL || "";
    const user = process.env.SURREALDB_USER || "admin";
    const pass = process.env.SURREALDB_PASS || "";
    const namespace = process.env.SURREALDB_NS || "solidflow";
    const database = process.env.SURREALDB_DB || "main";

    console.log(`Connecting to SurrealDB at ${url}...`);
    const db = new Surreal();
    try {
        await db.connect(url, {
            authentication: {
                username: user,
                password: pass,
            },
        });
        await db.use({ namespace, database });
        console.log("Connected successfully!");

        // Find the testdb workflow
        const result: any = await db.query("SELECT * FROM workflow WHERE name = 'testdb'");
        const workflows = result[0] || [];
        if (workflows.length === 0) {
            console.error("Workflow 'testdb' not found in database!");
            return;
        }

        const workflow = workflows[0];
        console.log("Found workflow:", workflow.id, workflow.name);

        const runId = `workflow_run:test-run-uuid`;
        console.log("Running workflow...");
        // Run it and wait for it to complete
        await runWorkflowBackground(workflow, runId);
        console.log("Execution finished!");

        // Read the run record from the database
        const runResult: any = await db.query("SELECT * FROM workflow_run WHERE id = $runId", { runId: new RecordId("workflow_run", "test-run-uuid") });
        console.log("Run Record:", JSON.stringify(runResult[0], null, 2));

    } catch (e: any) {
        console.error("Caught error during manual execution:", e);
    } finally {
        await db.close();
    }
}

runTest();
