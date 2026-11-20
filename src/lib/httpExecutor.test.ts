import { describe, it, expect, afterEach } from "bun:test";
import { executeHttpStreamCall } from "./httpExecutor";

function streamFromChunks(chunks: string[], contentType: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}

function runStream(url = "http://mock.local/stream") {
  const received: Array<{ raw: string; parsed?: any }> = [];
  return new Promise<Array<{ raw: string; parsed?: any }>>((resolve, reject) => {
    executeHttpStreamCall(
      { url },
      (chunk) => received.push(chunk),
      (err) => reject(err),
      () => resolve(received)
    );
  });
}

describe("executeHttpStreamCall", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("parses NDJSON split across chunk boundaries without duplicate trailing emission", async () => {
    globalThis.fetch = (async () =>
      streamFromChunks(
        ['{"id":1,"msg":"hel', 'lo"}\n{"id":2}\n', '{"id":3,"tail":true}'],
        "application/x-ndjson"
      )) as unknown as typeof fetch;

    const chunks = await runStream();
    expect(chunks.length).toBe(3);
    expect(chunks.map((c) => c.parsed)).toEqual([
      { id: 1, msg: "hello" },
      { id: 2 },
      { id: 3, tail: true },
    ]);
  });

  it("emits chunked plain text once per chunk with no duplicate final buffer", async () => {
    globalThis.fetch = (async () =>
      streamFromChunks(["chunk-1 ", "chunk-2 ", "chunk-3"], "text/plain")) as unknown as typeof fetch;

    const chunks = await runStream();
    expect(chunks).toEqual([
      { raw: "chunk-1 ", parsed: "chunk-1 " },
      { raw: "chunk-2 ", parsed: "chunk-2 " },
      { raw: "chunk-3", parsed: "chunk-3" },
    ]);
  });

  it("accumulates single JSON body chunks and parses once at EOF", async () => {
    globalThis.fetch = (async () =>
      streamFromChunks(['{"items":[', "1,2,3", "]}"], "application/json")) as unknown as typeof fetch;

    const chunks = await runStream();
    expect(chunks.length).toBe(1);
    expect(chunks[0].parsed).toEqual({ items: [1, 2, 3] });
  });

  it("parses SSE blocks including a final block without trailing double newline", async () => {
    globalThis.fetch = (async () =>
      streamFromChunks(
        ['event: tick\ndata: {"n":1}\n\nevent: done\n', 'data: {"ok":true}'],
        "text/event-stream"
      )) as unknown as typeof fetch;

    const chunks = await runStream();
    expect(chunks.length).toBe(2);
    expect(chunks[0].parsed).toEqual({ event: "tick", data: { n: 1 } });
    expect(chunks[1].parsed).toEqual({ event: "done", data: { ok: true } });
  });
});
