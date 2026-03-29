import protobuf from "protobufjs";

export interface ProtoField {
  name: string;
  type: string;
  repeated: boolean;
  mapKey?: string;
  mapValue?: string;
}

export interface ProtoMethod {
  name: string;
  requestType: string;
  responseType: string;
  requestStream: boolean;
  responseStream: boolean;
}

export interface ProtoService {
  name: string;
  fullName: string;
  methods: ProtoMethod[];
}

export interface ParsedProto {
  package: string;
  services: ProtoService[];
  messageTypes: Record<string, ProtoField[]>;
}

/**
 * Parse a .proto file content string and extract services, methods, and message types.
 */
export function parseProtoContent(content: string): ParsedProto {
  const root = protobuf.parse(content, { keepCase: true }).root;

  const services: ProtoService[] = [];
  const messageTypes: Record<string, ProtoField[]> = {};
  let packageName = "";

  function walkNamespace(ns: protobuf.NamespaceBase, parentPath: string) {
    if (ns instanceof protobuf.Namespace && (ns as any).name && parentPath === "") {
      // Check if this is a package-level namespace
      const nested = ns.nestedArray;
      if (nested.length > 0 && !(ns instanceof protobuf.Root)) {
        packageName = ns.fullName.replace(/^\./, "");
      }
    }

    for (const child of ns.nestedArray) {
      if (child instanceof protobuf.Service) {
        const service: ProtoService = {
          name: child.name,
          fullName: child.fullName.replace(/^\./, ""),
          methods: [],
        };

        for (const method of child.methodsArray) {
          service.methods.push({
            name: method.name,
            requestType: method.requestType,
            responseType: method.responseType,
            requestStream: method.requestStream || false,
            responseStream: method.responseStream || false,
          });
        }

        services.push(service);
      }

      if (child instanceof protobuf.Type) {
        const fields: ProtoField[] = [];

        for (const field of child.fieldsArray) {
          const f: ProtoField = {
            name: field.name,
            type: field.type,
            repeated: field.repeated || false,
          };

          if (field instanceof protobuf.MapField) {
            f.mapKey = field.keyType;
            f.mapValue = field.type;
          }

          fields.push(f);
        }

        messageTypes[child.name] = fields;
        messageTypes[child.fullName.replace(/^\./, "")] = fields;
      }

      if (child instanceof protobuf.Namespace) {
        walkNamespace(child, child.fullName);
      }
    }
  }

  walkNamespace(root, "");

  return { package: packageName, services, messageTypes };
}

/**
 * Generate a JSON skeleton object for a given message type name.
 */
export function generateSkeleton(
  messageTypes: Record<string, ProtoField[]>,
  typeName: string
): Record<string, any> {
  const fields = messageTypes[typeName];
  if (!fields) return {};

  const obj: Record<string, any> = {};

  for (const field of fields) {
    let value: any;

    switch (field.type) {
      case "string":
        value = "";
        break;
      case "bool":
        value = false;
        break;
      case "int32":
      case "int64":
      case "uint32":
      case "uint64":
      case "sint32":
      case "sint64":
      case "fixed32":
      case "fixed64":
      case "sfixed32":
      case "sfixed64":
        value = 0;
        break;
      case "float":
      case "double":
        value = 0.0;
        break;
      case "bytes":
        value = "";
        break;
      default:
        // Nested message type — recurse (but guard against recursion)
        if (messageTypes[field.type]) {
          value = generateSkeleton(messageTypes, field.type);
        } else {
          value = null;
        }
        break;
    }

    if (field.repeated) {
      obj[field.name] = [value];
    } else if (field.mapKey) {
      obj[field.name] = {};
    } else {
      obj[field.name] = value;
    }
  }

  return obj;
}
