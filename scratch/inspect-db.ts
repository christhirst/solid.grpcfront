import { Surreal } from "surrealdb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function inspect() {
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

        console.log("\n--- Target Workflows (name/id matching 'testdb') ---");
        const wfsResult: any = await db.query("SELECT * FROM workflow");
        const workflows = wfsResult[0] || [];
        const matchingWfs = workflows.filter((wf: any) => 
            String(wf.name).toLowerCase().includes("testdb") || 
            String(wf.id).toLowerCase().includes("testdb")
        );
        
        console.log(`Found ${matchingWfs.length} matching workflows:`);
        for (const wf of matchingWfs) {
            console.log(`- ID: ${wf.id}`);
            console.log(`  Name: ${wf.name}`);
            console.log(`  Steps: ${JSON.stringify(wf.steps, null, 2)}`);
            
            console.log(`\n  --- Runs for this Workflow ---`);
            const wfIdString = wf.id.toString();
            // Try matching either raw ID or without brackets
            const runsResult: any = await db.query("SELECT * FROM workflow_run WHERE workflowId = $wfId", { wfId: wfIdString });
            const runs = runsResult[0] || [];
            console.log(`  Found ${runs.length} runs:`);
            for (const run of runs) {
                console.log(`  * Run ID: ${run.id}`);
                console.log(`    Status: ${run.status}`);
                console.log(`    Start: ${run.startTime}`);
                console.log(`    EndTime: ${run.endTime}`);
                console.log(`    Logs: ${JSON.stringify(run.logs, null, 2)}`);
            }
        }

    } catch (e: any) {
        console.error("Error inspecting DB:", e.message);
    } finally {
        await db.close();
    }
}

inspect();
