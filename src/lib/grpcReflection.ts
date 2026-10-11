import * as grpc from "@grpc/grpc-js";
import protobuf from "protobufjs";
import descriptor from "protobufjs/ext/descriptor/index.js";
import { parseProtoRoot, type ParsedProto } from "./protoParser";

// Both reflection versions use the same wire format.
const protocol = protobuf.parse(`syntax = "proto3";
  message Request {
    string host = 1;
    oneof message_request {
      string file_by_filename = 3;
      string file_containing_symbol = 4;
      string list_services = 7;
    }
  }
  message Response {
    string valid_host = 1;
    Request original_request = 2;
    oneof message_response {
      Files file_descriptor_response = 4;
      Services list_services_response = 6;
      Error error_response = 7;
    }
  }
  message Files { repeated bytes file_descriptor_proto = 1; }
  message Services { repeated Service service = 1; }
  message Service { string name = 1; }
  message Error { int32 error_code = 1; string error_message = 2; }
`, { keepCase: true }).root;
const requestType = protocol.lookupType("Request");
const responseType = protocol.lookupType("Response");

export interface ReflectedSchema {
  descriptorSet: string;
  parsedProto: ParsedProto;
}

export interface ReflectionOptions {
  serverAddress: string;
  useTls?: boolean;
  caCert?: string;
  acceptInvalidCert?: boolean;
  metadata?: Record<string, string>;
  timeoutMs?: number;
}

export async function reflectGrpcServices(options: ReflectionOptions): Promise<ReflectedSchema> {
  const credentials = options.useTls
    ? grpc.credentials.createSsl(options.caCert ? Buffer.from(options.caCert) : null, undefined, undefined,
        options.acceptInvalidCert ? { rejectUnauthorized: false, checkServerIdentity: () => undefined } : undefined)
    : grpc.credentials.createInsecure();
  const client = new grpc.Client(options.serverAddress, credentials);
  const metadata = new grpc.Metadata();
  const deadline = new Date(Date.now() + (options.timeoutMs ?? 8000));

  try {
    for (const [key, value] of Object.entries(options.metadata || {})) metadata.set(key, value);
    for (const version of ["v1", "v1alpha"]) {
      const stream = client.makeBidiStreamRequest(
        `/grpc.reflection.${version}.ServerReflection/ServerReflectionInfo`,
        (value: object) => Buffer.from(requestType.encode(value).finish()),
        (value: Buffer) => responseType.toObject(responseType.decode(value)),
        metadata, { deadline },
      );
      let pending: { resolve: (value: any) => void; reject: (error: Error) => void } | undefined;
      let failure: Error | undefined;
      const fail = (error: Error) => {
        failure = error;
        pending?.reject(error);
        pending = undefined;
      };
      stream.on("error", fail);
      stream.on("end", () => fail(new Error("Reflection stream ended before returning a response.")));
      stream.on("data", (response: any) => {
        if (response.error_response) {
          fail(Object.assign(new Error(response.error_response.error_message || "Reflection request failed"), {
            code: response.error_response.error_code,
          }));
        } else {
          pending?.resolve(response);
          pending = undefined;
        }
      });
      const request = (value: object) => new Promise<any>((resolve, reject) => {
        if (failure) return reject(failure);
        pending = { resolve, reject };
        stream.write(value);
      });

      try {
        const listed = await request({ list_services: "" });
        const names: string[] = (listed.list_services_response?.service || [])
          .map((service: { name: string }) => service.name)
          .filter((name: string) => !name.startsWith("grpc.reflection."));
        const files = new Map<string, any>();
        const addFiles = (response: any) => {
          for (const bytes of response.file_descriptor_response?.file_descriptor_proto || []) {
            const file = descriptor.FileDescriptorProto.decode(bytes) as any;
            if (file.name) files.set(file.name, file);
          }
        };
        // Keep one stream open: servers may omit descriptors already sent on it.
        for (const name of names) addFiles(await request({ file_containing_symbol: name }));
        const requested = new Set<string>();
        for (;;) {
          const missing = [...files.values()].flatMap(file => file.dependency || [])
            .find(name => !files.has(name));
          if (!missing) break;
          if (requested.has(missing)) throw new Error(`Reflection did not return dependency ${missing}`);
          requested.add(missing);
          addFiles(await request({ file_by_filename: missing }));
        }
        const set = descriptor.FileDescriptorSet.create({ file: [...files.values()] });
        const root = (protobuf.Root as typeof protobuf.Root & {
          fromDescriptor(value: protobuf.Message): protobuf.Root;
        }).fromDescriptor(set);
        root.resolveAll();
        const parsedProto = parseProtoRoot(root);
        parsedProto.services = parsedProto.services.filter(service => names.includes(service.fullName));
        return {
          descriptorSet: Buffer.from(descriptor.FileDescriptorSet.encode(set).finish()).toString("base64"),
          parsedProto,
        };
      } catch (error: any) {
        if (version !== "v1" || error.code !== grpc.status.UNIMPLEMENTED) throw error;
      } finally {
        stream.cancel();
      }
    }
    throw new Error("Server reflection is unavailable.");
  } finally {
    client.close();
  }
}
