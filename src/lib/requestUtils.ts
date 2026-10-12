import type { APIEvent } from "@solidjs/start/server";

/**
 * Safely parses the JSON body from an APIEvent, Request, or H3/Node request object.
 * SolidStart / Nitro event.request is an H3 adapter wrapping Node/Bun IncomingMessage,
 * which does not expose a standard Web Request `.json()` method.
 */
export async function readJsonBody<T = any>(eventOrRequest?: APIEvent | Request | unknown): Promise<T> {
  if (!eventOrRequest) return {} as T;

  const req = (eventOrRequest as any)?.request ?? eventOrRequest;

  // 1. If body has already been parsed into an object by Nitro / H3 middleware
  if (
    req?.body &&
    typeof req.body === "object" &&
    !(req.body instanceof ReadableStream) &&
    !(req.body instanceof ArrayBuffer) &&
    !(typeof Buffer !== "undefined" && Buffer.isBuffer(req.body))
  ) {
    return req.body as T;
  }

  // 2. If it's a standard Web Request with a functional .json() method
  if (typeof req?.json === "function") {
    try {
      const parsed = await req.json();
      if (parsed !== undefined) return parsed as T;
    } catch {
      // Body may be locked or not standard Web stream; continue to fallbacks below
    }
  }

  // 3. If req.body is a string, Buffer, or ReadableStream
  if (req?.body) {
    try {
      if (typeof req.body === "string") return JSON.parse(req.body) as T;
      if (typeof Buffer !== "undefined" && Buffer.isBuffer(req.body)) {
        return JSON.parse(req.body.toString("utf8")) as T;
      }
      return (await new Response(req.body).json()) as T;
    } catch {}
  }

  // 4. H3 native body parser fallback
  const anyObj = eventOrRequest as any;
  const native = anyObj?.nativeEvent ?? (anyObj?.req ? anyObj : undefined);
  if (native) {
    try {
      const { readBody } = await import("h3");
      const b = await readBody(native);
      if (b !== undefined && b !== null) {
        return (typeof b === "string" ? JSON.parse(b) : b) as T;
      }
    } catch {}
  }

  return {} as T;
}
