import { e as executeGrpcCall } from "./grpcExecutor-DlteWgV8.js";
import "@grpc/grpc-js";
import "@grpc/proto-loader";
import "fs";
import "path";
import "os";
async function POST(event) {
  try {
    const body = await new Response(event.request.body).json();
    if (!body.protoContent || !body.serverAddress || !body.serviceName || !body.methodName) {
      return new Response(JSON.stringify({
        error: "Missing required fields: protoContent, serverAddress, serviceName, methodName"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const result = await executeGrpcCall(body);
    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 502,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      ...result,
      status: "OK"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Unknown proxy error"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
export {
  POST
};
//# sourceMappingURL=grpc-WMfO0-_6.js.map
