import cron, { ScheduledTask } from "node-cron";
import { getDb } from "~/lib/db";
import { runWorkflowBackground, WorkflowDefinition } from "~/lib/workflowEngine";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";

const console = {
  log: (...args: any[]) => logger.info(...args),
  error: (...args: any[]) => logger.error(...args),
  warn: (...args: any[]) => logger.warn(...args),
};

// Store scheduled jobs to allow stopping/updating them
const scheduledJobs = new Map<string, ScheduledTask>();

/**
 * Initialize all scheduled workflows from the database.
 */
export async function initWorkflowScheduler() {
  console.log("Initializing workflow scheduler...");
  try {
    const db = await getDb();
    const result = await db.query("SELECT * FROM workflow WHERE schedule AND schedule != ''");
    const workflows = (result[0] || []) as any[];

    for (const wfData of workflows) {
      if (wfData.schedule) {
        scheduleWorkflow(wfData);
      }
    }
    console.log(`Initialized scheduler with ${workflows.length} workflows.`);
  } catch (error) {
    console.error("Failed to initialize workflow scheduler:", error);
  }
}

/**
 * Schedule or reschedule a single workflow.
 */
export function scheduleWorkflow(workflow: any) {
  const workflowId = workflow.id.toString().replace(/[⟨⟩]/g, "");
  
  // Stop existing job if it exists
  if (scheduledJobs.has(workflowId)) {
    console.log(`Unscheduling workflow: ${workflowId}`);
    scheduledJobs.get(workflowId)?.stop();
    scheduledJobs.delete(workflowId);
  }

  if (!workflow.schedule) return;

  try {
    const job = cron.schedule(workflow.schedule, async () => {
      console.log(`Running scheduled workflow: ${workflow.name} (${workflowId})`);
      const runId = `workflow_run:${uuidv4()}`;
      
      // We need to pass the full workflow definition
      // Since wfData from DB might have RecordId, we normalize it
      const normalizedWorkflow: WorkflowDefinition = {
        ...workflow,
        id: workflowId,
      };

      try {
        await runWorkflowBackground(normalizedWorkflow, runId);
      } catch (err) {
        console.error(`Scheduled run failed for ${workflowId}:`, err);
      }
    });

    scheduledJobs.set(workflowId, job);
    console.log(`Scheduled workflow: ${workflow.name} (${workflowId}) with cron: ${workflow.schedule}`);
  } catch (err) {
    console.error(`Failed to schedule workflow ${workflowId} with cron "${workflow.schedule}":`, err);
  }
}

/**
 * Unschedule a workflow (e.g. when deleted or schedule removed).
 */
export function unscheduleWorkflow(id: any) {
  const workflowId = id.toString().replace(/[⟨⟩]/g, "");
  if (scheduledJobs.has(workflowId)) {
    console.log(`Unscheduling workflow: ${workflowId}`);
    scheduledJobs.get(workflowId)?.stop();
    scheduledJobs.delete(workflowId);
  }
}
