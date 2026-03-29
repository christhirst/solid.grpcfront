import { APIEvent } from "@solidjs/start/server";
import { executeGrpcCall, type GrpcCallParams } from "~/lib/grpcExecutor";

export async function POST(event: APIEvent) {
  try {
    const body: GrpcCallParams = await new Response(event.request.body).json();

    if (!body.protoContent || !body.serverAddress || !body.serviceName || !body.methodName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: protoContent, serverAddress, serviceName, methodName" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await executeGrpcCall(body);

    if (!result.success) {
      return new Response(
        JSON.stringify(result),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Add status property for backward compatibility with existing UI
    return new Response(
      JSON.stringify({ ...result, status: "OK" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Unknown proxy error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
