import { APIEvent } from "@solidjs/start/server";

export function GET(event: APIEvent) {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
