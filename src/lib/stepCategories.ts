/**
 * Workflow step category classification and type definitions.
 * This module is safe for client-side imports (no server dependencies).
 */

export type StepCategory = "source" | "transform" | "target";

/**
 * Checks if a connection is designated as an OAuth token provider.
 * Client-safe helper (no backend/node dependencies).
 */
export function isOAuthProvider(conn: any): boolean {
  if (!conn) return false;
  if (conn.oauthProvider === true) return true;
  if (conn.oauthProvider === false) return false;
  return (conn.authType === "oauth" || conn.type === "oauth") && Boolean(conn.tokenUrl);
}

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

export interface StepVariable {
  id: string;
  name: string; // The bracketed token or expression, e.g. "DB_Table" or "count((SELECT id FROM incident_source)) > 0;"
  alias?: string; // Human-friendly alias, e.g. "has_incidents" or "target_table"
  direction: "up" | "down"; // "up" = green (upload/output), "down" = red (download/input)
  type?: "string" | "number" | "boolean" | "query" | "any";
  description?: string;
  value?: any; // Last evaluated value
}

export interface WorkflowStep {
  id: string;
  type?: "grpc" | "table" | "chart" | "database" | "rest" | "grpc_stream" | "rest_stream" | "surreal_live" | "infographic" | "transform" | "s3" | "oauth_token";
  category?: StepCategory;
  /** Data flow direction: "read" fetches data FROM the source, "write" sends data TO the source. */
  direction?: "read" | "write";
  /** Upstream/Downstream variables detected or configured in this step. */
  variables?: StepVariable[];
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
  protoContent?: string;
  grpcProtoId?: string;
  grpcDescriptorSet?: string;
  grpcSchemaConnectionId?: string;
  grpcParsedProto?: import("./protoParser").ParsedProto;
  restUrl?: string;
  restMethod?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  requestBodyTemplate?: string;
  headersTemplate?: string;
  serverAddress?: string;
  useTls?: boolean;
  acceptInvalidCert?: boolean;
  caId?: string;
  dataPath?: string;
  xKey?: string;
  yKey?: string;
  chartType?: "bar" | "line";
  columns?: string[];
  authType?: "none" | "basic" | "bearer" | "oauth";
  authUsername?: string;
  authPassword?: string;
  bearerToken?: string;
  /** Specific connection to use strictly for authentication / tokens (leaving endpoint URL intact). */
  authConnectionId?: string;
  connectionId?: string;
  connectionMode?: "saved" | "custom";
  // S3 storage step overrides & file selector fields (outputs filenames/URIs only, never binary file content)
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3Prefix?: string;
  s3Pattern?: string;
  s3SelectedKeys?: string[];
  s3ForcePathStyle?: boolean;
  s3MaxKeys?: number;
  s3OutputFormat?: "uri" | "key" | "filename";
}
