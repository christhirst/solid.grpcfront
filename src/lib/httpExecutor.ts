export interface HttpStreamCallParams {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  /** TLS configuration supported by Bun's fetch implementation. */
  tls?: { ca?: string; rejectUnauthorized?: boolean };
  /** Optional stream timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * Execute HTTP streaming call (supporting chunked response and SSE event streams).
 */
export async function executeHttpStreamCall(
  params: HttpStreamCallParams,
  onChunk: (chunk: { raw: string; parsed?: any }) => void,
  onError: (error: any) => void,
  onEnd: () => void
): Promise<{ cancel: () => void }> {
  const controller = new AbortController();
  const { url, method = "GET", headers = {}, body, tls, timeoutMs } = params;

  let requestUrl = url;
  if (requestUrl && !requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
    const separator = requestUrl.startsWith("/") ? "" : "/";
    const port = process.env.PORT || 3000;
    requestUrl = `http://127.0.0.1:${port}${separator}${requestUrl}`;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const effectiveTimeoutMs = Number(timeoutMs);
  if (effectiveTimeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error(`HTTP stream timed out after ${effectiveTimeoutMs}ms`));
    }, effectiveTimeoutMs);
  }

  (async () => {
    try {
      const fetchHeaders: Record<string, string> = { ...headers };
      let fetchBody: string | undefined = undefined;

      if (body !== undefined && method !== "GET" && method !== "DELETE") {
        if (typeof body === "object") {
          fetchBody = JSON.stringify(body);
          if (!fetchHeaders["Content-Type"]) fetchHeaders["Content-Type"] = "application/json";
        } else {
          fetchBody = String(body);
        }
      }

      const fetchOptions: any = {
        method,
        headers: fetchHeaders,
        body: fetchBody,
        signal: controller.signal,
      };
      if (tls) fetchOptions.tls = tls;
      const res = await fetch(requestUrl, fetchOptions);

      if (!res.ok) {
        const text = await res.text();
        onError(new Error(`HTTP ${res.status}: ${text}`));
        return;
      }

      if (!res.body) {
        onEnd();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      const isEventStream = contentType.includes("text/event-stream");
      const isNdjson =
        contentType.includes("application/x-ndjson") ||
        contentType.includes("application/ndjson") ||
        contentType.includes("application/jsonl");
      const isSingleJson = !isEventStream && !isNdjson && contentType.includes("json");
      const jsonChunks: string[] = [];

      const emitSseBlock = (rawBlock: string) => {
        if (!rawBlock.trim()) return;
        let eventType = "message";
        let eventData = "";

        for (const line of rawBlock.split("\n")) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            eventData += (eventData ? "\n" : "") + line.slice(5).trim();
          }
        }

        let parsed: any = eventData;
        try {
          parsed = JSON.parse(eventData);
        } catch {}

        onChunk({ raw: rawBlock, parsed: { event: eventType, data: parsed } });
      };

      const emitNdjsonLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let parsed: any = trimmed;
        try {
          parsed = JSON.parse(trimmed);
        } catch {}
        onChunk({ raw: trimmed, parsed });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        if (!text) continue;

        if (isEventStream) {
          buffer += text;
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";
          for (const rawBlock of blocks) {
            emitSseBlock(rawBlock);
          }
        } else if (isNdjson) {
          buffer += text;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            emitNdjsonLine(line);
          }
        } else if (isSingleJson) {
          jsonChunks.push(text);
        } else {
          // Chunked plain text stream: emit each chunk once without quadratic buffering
          onChunk({ raw: text, parsed: text });
        }
      }

      const tail = decoder.decode();
      if (isEventStream) {
        if (tail) buffer += tail;
        if (buffer.trim()) emitSseBlock(buffer);
      } else if (isNdjson) {
        if (tail) buffer += tail;
        if (buffer.trim()) emitNdjsonLine(buffer);
      } else if (isSingleJson) {
        if (tail) jsonChunks.push(tail);
        const full = jsonChunks.join("");
        if (full.trim()) {
          try {
            const parsed = JSON.parse(full);
            onChunk({ raw: full, parsed });
          } catch {
            // Fallback for servers emitting NDJSON with application/json content-type
            const lines = full.split("\n").filter((l) => l.trim().length > 0);
            if (lines.length > 1) {
              for (const line of lines) emitNdjsonLine(line);
            } else {
              onChunk({ raw: full, parsed: full });
            }
          }
        }
      } else if (tail) {
        onChunk({ raw: tail, parsed: tail });
      }

      onEnd();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        onError(err);
      } else if (timeoutId && controller.signal.reason instanceof Error) {
        onError(controller.signal.reason);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  })();

  return {
    cancel: () => {
      if (timeoutId) clearTimeout(timeoutId);
      controller.abort();
    },
  };
}
