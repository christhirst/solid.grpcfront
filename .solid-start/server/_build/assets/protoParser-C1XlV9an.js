import protobuf from "protobufjs";
function parseProtoContent(content) {
  const root = protobuf.parse(content, {
    keepCase: true
  }).root;
  const services = [];
  const messageTypes = {};
  let packageName = "";
  function walkNamespace(ns, parentPath) {
    if (ns instanceof protobuf.Namespace && ns.name && parentPath === "") {
      const nested = ns.nestedArray;
      if (nested.length > 0 && !(ns instanceof protobuf.Root)) {
        packageName = ns.fullName.replace(/^\./, "");
      }
    }
    for (const child of ns.nestedArray) {
      if (child instanceof protobuf.Service) {
        const service = {
          name: child.name,
          fullName: child.fullName.replace(/^\./, ""),
          methods: []
        };
        for (const method of child.methodsArray) {
          service.methods.push({
            name: method.name,
            requestType: method.requestType,
            responseType: method.responseType,
            requestStream: method.requestStream || false,
            responseStream: method.responseStream || false
          });
        }
        services.push(service);
      }
      if (child instanceof protobuf.Type) {
        const fields = [];
        for (const field of child.fieldsArray) {
          const f = {
            name: field.name,
            type: field.type,
            repeated: field.repeated || false
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
  return {
    package: packageName,
    services,
    messageTypes
  };
}
function generateSkeleton(messageTypes, typeName) {
  const fields = messageTypes[typeName];
  if (!fields) return {};
  const obj = {};
  for (const field of fields) {
    let value;
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
        value = 0;
        break;
      case "bytes":
        value = "";
        break;
      default:
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
export {
  generateSkeleton as g,
  parseProtoContent as p
};
//# sourceMappingURL=protoParser-C1XlV9an.js.map
