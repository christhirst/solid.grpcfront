/**
 * Built-in AuthZEN 1.0 (OpenID Foundation), RRM, and Cerbos Policy Decision Point (PDP)
 * schemas, `google.protobuf.Struct` converters, and request/response adapters.
 */

export const AUTHZEN_PROTO_CONTENT = `syntax = "proto3";

package authzen.authorization.v1;

import "google/protobuf/struct.proto";

// ============================================================================
// AuthZEN Authorization API 1.0 (OpenID Foundation)
// ============================================================================

service AuthorizationService {
  // Evaluates a single access request (Subject-Action-Resource-Context)
  rpc AccessEvaluation(EvaluationRequest) returns (EvaluationResponse);

  // Evaluates a batch of access requests in a single round-trip
  rpc AccessEvaluationBatch(AccessEvaluationBatchRequest) returns (AccessEvaluationBatchResponse);
}

message Subject {
  string type = 1;
  string id = 2;
  google.protobuf.Struct properties = 3;
}

message Action {
  string name = 1;
  google.protobuf.Struct properties = 2;
}

message Resource {
  string type = 1;
  string id = 2;
  google.protobuf.Struct properties = 3;
}

message EvaluationRequest {
  string space_id = 1;
  Subject subject = 2;
  Action action = 3;
  Resource resource = 4;
  google.protobuf.Struct context = 5;
}

message EvaluationResponse {
  bool decision = 1;
  google.protobuf.Struct context = 2;
}

message EvaluationItem {
  string id = 1;
  Subject subject = 2;
  Action action = 3;
  Resource resource = 4;
  google.protobuf.Struct context = 5;
}

message AccessEvaluationBatchRequest {
  string space_id = 1;
  Subject subject = 2;
  Action action = 3;
  Resource resource = 4;
  google.protobuf.Struct context = 5;
  repeated EvaluationItem evaluations = 6;
}

message EvaluationItemResponse {
  string id = 1;
  bool decision = 2;
  google.protobuf.Struct context = 3;
}

message AccessEvaluationBatchResponse {
  repeated EvaluationItemResponse evaluations = 1;
}
`;

export const RRM_AUTHZ_PROTO_CONTENT = `syntax = "proto3";

package rrm.v1;

message EntityUidMsg {
  string entity_type = 1;
  string entity_id = 2;
}

message CedarEntityRecord {
  string space_id = 1;
  EntityUidMsg uid = 2;
  repeated EntityUidMsg parents = 3;
  string attributes_json = 4;
  string updated_at = 5;
}

service AuthorizationService {
  rpc Authorize(AuthorizeRequest) returns (AuthorizeResponse);
}

enum AuthDecision {
  AUTH_DECISION_UNSPECIFIED = 0;
  AUTH_DECISION_ALLOW = 1;
  AUTH_DECISION_DENY = 2;
}

message AuthorizeRequest {
  string space_id = 1;
  EntityUidMsg principal = 2;
  EntityUidMsg action = 3;
  EntityUidMsg resource = 4;
  string context_json = 5;
  repeated CedarEntityRecord additional_entities = 6;
}

message AuthorizeResponse {
  bool allowed = 1;
  AuthDecision decision = 2;
  repeated string determining_policies = 3;
  repeated string errors = 4;
}
`;

export type AuthzProvider = "authzen_grpc" | "authzen_rest" | "rrm_grpc" | "cerbos_rest";
export type AuthzOnDeny = "enforce" | "continue";

/**
 * Checks if an object is already in `@grpc/proto-loader` `google.protobuf.Value` format.
 */
function isProtoValueObject(val: any): boolean {
  if (!val || typeof val !== "object" || Array.isArray(val)) return false;
  const keys = Object.keys(val);
  if (keys.length === 0) return false;
  const validValueKeys = new Set([
    "null_value",
    "nullValue",
    "number_value",
    "numberValue",
    "string_value",
    "stringValue",
    "bool_value",
    "boolValue",
    "struct_value",
    "structValue",
    "list_value",
    "listValue",
    "kind",
  ]);
  return keys.every((k) => validValueKeys.has(k));
}

/**
 * Checks if an object is already in `@grpc/proto-loader` `google.protobuf.Struct` wire format (`{ fields: { ... } }`).
 */
export function isProtoStructFormat(val: any): boolean {
  if (!val || typeof val !== "object" || Array.isArray(val)) return false;
  const keys = Object.keys(val);
  if (keys.length !== 1 || keys[0] !== "fields") return false;
  const fields = val.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return false;
  const fieldValues = Object.values(fields);
  if (fieldValues.length === 0) return true;
  return fieldValues.every((fv) => isProtoValueObject(fv));
}

/**
 * Convert a plain JavaScript value into a `google.protobuf.Value` object compatible with `@grpc/proto-loader` (`keepCase: true`).
 */
export function jsonToProtoValue(val: any): Record<string, any> {
  if (val === null || val === undefined) {
    return { null_value: 0 };
  }
  if (typeof val === "boolean") {
    return { bool_value: val };
  }
  if (typeof val === "number") {
    return { number_value: Number.isFinite(val) ? val : 0 };
  }
  if (typeof val === "string") {
    return { string_value: val };
  }
  if (Array.isArray(val)) {
    return {
      list_value: {
        values: val.map((item) => jsonToProtoValue(item)),
      },
    };
  }
  if (typeof val === "object") {
    if (isProtoValueObject(val)) return val;
    return {
      struct_value: jsonToProtoStruct(val),
    };
  }
  return { string_value: String(val) };
}

/**
 * Convert a plain JavaScript object into a `google.protobuf.Struct` object (`{ fields: { ... } }`)
 * compatible with `@grpc/proto-loader` (`keepCase: true`) and Tonic `prost_types::Struct`.
 */
export function jsonToProtoStruct(obj: any): { fields: Record<string, any> } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { fields: {} };
  }
  if (isProtoStructFormat(obj)) {
    return obj;
  }
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    fields[k] = jsonToProtoValue(v);
  }
  return { fields };
}

/**
 * Convert a `google.protobuf.Value` object from `@grpc/proto-loader` back into a plain JavaScript value.
 */
export function protoValueToJson(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val !== "object" || Array.isArray(val)) return val;

  if ("string_value" in val && val.string_value !== undefined) return val.string_value;
  if ("stringValue" in val && val.stringValue !== undefined) return val.stringValue;
  if ("number_value" in val && val.number_value !== undefined) return val.number_value;
  if ("numberValue" in val && val.numberValue !== undefined) return val.numberValue;
  if ("bool_value" in val && val.bool_value !== undefined) return val.bool_value;
  if ("boolValue" in val && val.boolValue !== undefined) return val.boolValue;
  if ("null_value" in val || "nullValue" in val) return null;
  if ("struct_value" in val && val.struct_value !== undefined) {
    return protoStructToJson(val.struct_value);
  }
  if ("structValue" in val && val.structValue !== undefined) {
    return protoStructToJson(val.structValue);
  }
  if ("list_value" in val && val.list_value !== undefined) {
    const values = Array.isArray(val.list_value?.values) ? val.list_value.values : [];
    return values.map((v: any) => protoValueToJson(v));
  }
  if ("listValue" in val && val.listValue !== undefined) {
    const values = Array.isArray(val.listValue?.values) ? val.listValue.values : [];
    return values.map((v: any) => protoValueToJson(v));
  }
  if (isProtoStructFormat(val)) {
    return protoStructToJson(val);
  }
  return val;
}

/**
 * Convert a `google.protobuf.Struct` object (`{ fields: { ... } }`) from `@grpc/proto-loader`
 * back into a plain JavaScript object.
 */
export function protoStructToJson(structVal: any): Record<string, any> {
  if (!structVal || typeof structVal !== "object" || Array.isArray(structVal)) {
    return {};
  }
  if (isProtoStructFormat(structVal)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(structVal.fields || {})) {
      out[k] = protoValueToJson(v);
    }
    return out;
  }
  // Already a plain object
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(structVal)) {
    out[k] = isProtoValueObject(v) || isProtoStructFormat(v) ? protoValueToJson(v) : v;
  }
  return out;
}

/**
 * Convert an AuthZEN `EvaluationRequest` or `AccessEvaluationBatchRequest` with plain JS objects
 * in `properties` / `context` into `@grpc/proto-loader` `google.protobuf.Struct` format.
 */
export function toAuthzenGrpcRequest(payload: Record<string, any>): Record<string, any> {
  if (!payload || typeof payload !== "object") return {};
  const convertEntity = (entity: any) => {
    if (!entity || typeof entity !== "object") return undefined;
    const out: Record<string, any> = { ...entity };
    if (out.properties !== undefined && out.properties !== null) {
      out.properties = jsonToProtoStruct(out.properties);
    }
    return out;
  };

  const result: Record<string, any> = { ...payload };
  if (result.subject) result.subject = convertEntity(result.subject);
  if (result.action) result.action = convertEntity(result.action);
  if (result.resource) result.resource = convertEntity(result.resource);
  if (result.context !== undefined && result.context !== null) {
    result.context = jsonToProtoStruct(result.context);
  }
  if (Array.isArray(result.evaluations)) {
    result.evaluations = result.evaluations.map((item: any) => {
      if (!item || typeof item !== "object") return item;
      const converted: Record<string, any> = { ...item };
      if (converted.subject) converted.subject = convertEntity(converted.subject);
      if (converted.action) converted.action = convertEntity(converted.action);
      if (converted.resource) converted.resource = convertEntity(converted.resource);
      if (converted.context !== undefined && converted.context !== null) {
        converted.context = jsonToProtoStruct(converted.context);
      }
      return converted;
    });
  }
  return result;
}

/**
 * Unwrap `google.protobuf.Struct` fields in an AuthZEN gRPC response into plain JavaScript objects.
 */
export function fromAuthzenGrpcResponse(res: any): Record<string, any> {
  if (!res || typeof res !== "object") return { decision: false, context: {} };
  const out: Record<string, any> = { ...res };
  if (out.context !== undefined) {
    out.context = protoStructToJson(out.context);
  }
  if (Array.isArray(out.evaluations)) {
    out.evaluations = out.evaluations.map((item: any) => {
      if (!item || typeof item !== "object") return item;
      return {
        ...item,
        context: item.context !== undefined ? protoStructToJson(item.context) : {},
      };
    });
  }
  return out;
}

export interface NormalizedAuthzInput {
  spaceId: string;
  subjectType: string;
  subjectId: string;
  subjectProperties: Record<string, any>;
  actionName: string;
  actionProperties: Record<string, any>;
  resourceType: string;
  resourceId: string;
  resourceProperties: Record<string, any>;
  context: Record<string, any>;
}

export interface NormalizedAuthzResult {
  decision: boolean;
  allowed: boolean;
  provider: AuthzProvider;
  reason?: string;
  determining_policies?: string[];
  errors?: string[];
  context: Record<string, any>;
  raw: any;
}

/**
 * Build a Cerbos `CheckResources` REST API payload from normalized SARC inputs.
 */
export function buildCerbosRestPayload(input: NormalizedAuthzInput, requestId: string): Record<string, any> {
  const rolesFromProps: string[] = [];
  if (Array.isArray(input.subjectProperties?.roles)) {
    for (const r of input.subjectProperties.roles) {
      if (r) rolesFromProps.push(String(r));
    }
  }
  if (typeof input.subjectProperties?.role === "string" && input.subjectProperties.role.trim()) {
    rolesFromProps.push(input.subjectProperties.role.trim());
  }
  if (typeof input.subjectProperties?.platformRole === "string" && input.subjectProperties.platformRole.trim()) {
    rolesFromProps.push(input.subjectProperties.platformRole.trim());
  }
  if (typeof input.subjectProperties?.userdata?.platformRole === "string") {
    rolesFromProps.push(input.subjectProperties.userdata.platformRole);
  }
  if (Array.isArray(input.subjectProperties?.userdata?.groups)) {
    for (const g of input.subjectProperties.userdata.groups) {
      if (g) rolesFromProps.push(String(g));
    }
  }
  if (Array.isArray(input.subjectProperties?.oidc?.claims?.groups)) {
    for (const g of input.subjectProperties.oidc.claims.groups) {
      if (g) rolesFromProps.push(String(g));
    }
  }
  const uniqueRoles = Array.from(new Set(rolesFromProps.filter(Boolean)));
  if (uniqueRoles.length === 0) {
    uniqueRoles.push("user");
  }

  return {
    requestId,
    principal: {
      id: input.subjectId || "anonymous",
      roles: uniqueRoles,
      attr: input.subjectProperties || {},
    },
    resources: [
      {
        resource: {
          kind: input.resourceType || "resource",
          id: input.resourceId || "default",
          attr: input.resourceProperties || {},
        },
        actions: [input.actionName || "access"],
      },
    ],
    auxData: Object.keys(input.context || {}).length > 0 ? { jwt: input.context } : undefined,
  };
}

/**
 * Normalize responses from AuthZEN gRPC/REST, RRM native gRPC, or Cerbos REST into a unified decision result.
 */
export function normalizeAuthzResponse(provider: AuthzProvider, raw: any, actionName?: string): NormalizedAuthzResult {
  if (!raw || typeof raw !== "object") {
    return {
      decision: false,
      allowed: false,
      provider,
      reason: "Empty response from Policy Decision Point",
      context: {},
      raw,
    };
  }

  if (provider === "cerbos_rest") {
    // Cerbos CheckResources response: { results: [ { resource: {...}, actions: { "<action>": "EFFECT_ALLOW" | "EFFECT_DENY" } } ] }
    let decision = false;
    if (typeof raw.decision === "boolean") {
      decision = raw.decision;
    } else if (Array.isArray(raw.results) && raw.results.length > 0) {
      const first = raw.results[0];
      const actionsMap = first?.actions || {};
      if (actionName && actionsMap[actionName]) {
        decision = actionsMap[actionName] === "EFFECT_ALLOW";
      } else {
        const effects = Object.values(actionsMap);
        decision = effects.length > 0 && effects.every((e) => e === "EFFECT_ALLOW");
      }
    }
    return {
      decision,
      allowed: decision,
      provider,
      reason: decision ? "EFFECT_ALLOW" : "EFFECT_DENY",
      context: raw.results?.[0] || {},
      raw,
    };
  }

  if (provider === "rrm_grpc") {
    const decision =
      typeof raw.allowed === "boolean"
        ? raw.allowed
        : raw.decision === "AUTH_DECISION_ALLOW" || raw.decision === 1 || raw.decision === true;
    const policies = Array.isArray(raw.determining_policies) ? raw.determining_policies : [];
    const errors = Array.isArray(raw.errors) ? raw.errors : [];
    return {
      decision,
      allowed: decision,
      provider,
      reason: errors.length > 0 ? errors.join("; ") : decision ? "Permit" : "Deny",
      determining_policies: policies,
      errors,
      context: {
        determining_policies: policies,
        errors,
      },
      raw,
    };
  }

  // authzen_grpc or authzen_rest
  const unwrapped = provider === "authzen_grpc" ? fromAuthzenGrpcResponse(raw) : raw;
  let decision = Boolean(unwrapped.decision);
  if (unwrapped.decision === undefined && Array.isArray(unwrapped.evaluations) && unwrapped.evaluations.length > 0) {
    decision = unwrapped.evaluations.every((ev: any) => Boolean(ev?.decision));
  }
  const ctx =
    unwrapped.context && typeof unwrapped.context === "object"
      ? unwrapped.context
      : {};
  const reason =
    typeof ctx.reason === "string"
      ? ctx.reason
      : typeof ctx.error === "string"
        ? ctx.error
        : decision
          ? "Access allowed by PDP"
          : "Access denied by PDP";
  const policies = Array.isArray(ctx.determining_policies) ? ctx.determining_policies : undefined;
  const errors = Array.isArray(ctx.errors) ? ctx.errors : undefined;

  return {
    decision,
    allowed: decision,
    provider,
    reason,
    determining_policies: policies,
    errors,
    context: ctx,
    raw: unwrapped,
  };
}
