/**
 * Workflow step category classification and type definitions.
 * This module is safe for client-side imports (no server dependencies).
 */

export type StepCategory = "source" | "transform" | "target";

export function getStepCategory(type?: string, explicitCategory?: StepCategory, sourceStepIds?: string[]): StepCategory {
  // If explicitly set, respect it (except terminal visual targets which can only be targets)
  if (type === "table" || type === "chart" || type === "infographic") {
    return "target";
  }

  if (explicitCategory) {
    return explicitCategory;
  }

  switch (type) {
    case "transform":
      return "transform";
    default:
      // gRPC, REST, Database can act as intermediate transforms if connected to upstream source(s)
      if (sourceStepIds && sourceStepIds.length > 0) {
        return "transform";
      }
      return "source";
  }
}

export interface WorkflowStep {
  id: string;
  type?: "grpc" | "table" | "chart" | "database" | "rest" | "grpc_stream" | "rest_stream" | "surreal_live" | "infographic" | "transform";
  category?: StepCategory;
  transformExpression?: string;
  transformType?: "jsonata" | "filter" | "map" | "merge";
  sourceStepIds?: string[];
  mergeStrategy?: "concat" | "merge_object" | "keyed";
  infographicSyntax?: string;
  infographicTemplate?: string;
  infographicEditable?: boolean;
  databaseName?: string;
  databaseUrl?: string;
  databaseUser?: string;
  databasePass?: string;
  databaseNs?: string;
  serviceName?: string;
  methodName?: string;
  restUrl?: string;
  restMethod?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  requestBodyTemplate?: string;
  headersTemplate?: string;
  serverAddress?: string;
  useTls?: boolean;
  caId?: string;
  dataPath?: string;
  xKey?: string;
  yKey?: string;
  chartType?: "bar" | "line";
  columns?: string[];
  authType?: "none" | "basic" | "oauth";
  authUsername?: string;
  authPassword?: string;
  connectionId?: string;
}
