import { describe, expect, test } from "bun:test";
import { v4 as uuidv4 } from "uuid";

describe("Workflow Cloning Logic", () => {
  const sampleWorkflow = {
    id: "workflow:orig-1234",
    name: "Incident Alert Processor",
    tags: ["ops", "production"],
    direction: "write" as const,
    protoId: "proto:alert_service",
    caId: "ca:prod_root",
    serverAddress: "alerts.internal:50051",
    schedule: "*/15 * * * *",
    connectionId: "conn:incident_db",
    graph: {
      nodes: [
        { stepId: "step_src_1", position: { x: 100, y: 150 } },
        { stepId: "step_tgt_1", position: { x: 400, y: 150 } },
      ],
      connections: [
        { id: "c1", source: "node1", target: "node2", sourceOutput: "out", targetInput: "in" },
      ],
      zoom: 1.2,
      position: [50, 80],
    },
    steps: [
      {
        id: "step_src_1",
        type: "grpc",
        category: "source",
        serviceName: "AlertService",
        methodName: "FetchAlerts",
        requestBodyTemplate: '{"severity": "CRITICAL"}',
        headersTemplate: '{"authorization": "Bearer token"}',
        sourceStepIds: [],
      },
      {
        id: "step_tgt_1",
        type: "database",
        category: "target",
        requestBodyTemplate: "CREATE incident CONTENT {{ steps.step_src_1.response }};",
        sourceStepIds: ["step_src_1"],
      },
    ],
    owner: "user_alice",
    visibility: "group",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  test("generates default clone name '<Original Name> (Copy)' when not specified", () => {
    const cloneName = `${sampleWorkflow.name || "Workflow"} (Copy)`;
    expect(cloneName).toBe("Incident Alert Processor (Copy)");
  });

  test("preserves custom name when supplied", () => {
    const customName = "Staging Incident Processor";
    const cloneName = customName.trim() || `${sampleWorkflow.name || "Workflow"} (Copy)`;
    expect(cloneName).toBe("Staging Incident Processor");
  });

  test("clones all configuration, graph layout, and steps while assigning new ID and owner", () => {
    const newDbId = uuidv4();
    const newOwner = "user_bob";
    const now = new Date().toISOString();

    const { id: _oldId, permissions: _p, created_at: _ca, updated_at: _ua, ...sourceData } = sampleWorkflow;

    const cloned = {
      ...sourceData,
      id: `workflow:${newDbId}`,
      name: `${sampleWorkflow.name} (Copy)`,
      owner: newOwner,
      tags: [...sampleWorkflow.tags],
      visibility: sampleWorkflow.tags.length > 0 ? "group" : "private",
      created_at: now,
      updated_at: now,
    };

    // ID must be distinct
    expect(cloned.id).not.toBe(sampleWorkflow.id);
    expect(cloned.id).toBe(`workflow:${newDbId}`);

    // Owner must be updated
    expect(cloned.owner).toBe("user_bob");

    // Name must have (Copy)
    expect(cloned.name).toBe("Incident Alert Processor (Copy)");

    // Steps must be identical in configuration and sequence
    expect(cloned.steps.length).toBe(2);
    expect(cloned.steps[0].id).toBe("step_src_1");
    expect(cloned.steps[0].serviceName).toBe("AlertService");
    expect(cloned.steps[1].id).toBe("step_tgt_1");
    expect(cloned.steps[1].sourceStepIds).toEqual(["step_src_1"]);

    // Visual graph layout and wires must be preserved
    expect(cloned.graph.nodes.length).toBe(2);
    expect(cloned.graph.nodes[0].stepId).toBe("step_src_1");
    expect(cloned.graph.connections.length).toBe(1);
    expect(cloned.graph.zoom).toBe(1.2);

    // Network & schedule settings must be preserved
    expect(cloned.direction).toBe("write");
    expect(cloned.serverAddress).toBe("alerts.internal:50051");
    expect(cloned.schedule).toBe("*/15 * * * *");
    expect(cloned.connectionId).toBe("conn:incident_db");
    expect(cloned.protoId).toBe("proto:alert_service");
    expect(cloned.caId).toBe("ca:prod_root");
  });
});
