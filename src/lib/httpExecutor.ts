export interface HttpStreamCallParams {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  /** TLS configuration supported by Bun's fetch implementation. */
  tls?: { ca?: string; rejectUnauthorized?: boolean };
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
  const { url, method = "GET", headers = {}, body, tls } = params;

  let requestUrl = url;
  if (requestUrl && !requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
    const separator = requestUrl.startsWith("/") ? "" : "/";
    const port = process.env.PORT || 3000;
    requestUrl = `http://127.0.0.1:${port}${separator}${requestUrl}`;
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

      const isEventStream = res.headers.get("content-type")?.includes("text/event-stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        buffer += text;

        if (isEventStream) {
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const rawBlock of lines) {
            if (!rawBlock.trim()) continue;
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
          }
        } else {
          // Chunked text or JSON stream
          let parsed: any = buffer;
          try {
            parsed = JSON.parse(buffer);
          } catch {}
          onChunk({ raw: text, parsed });
        }
      }

      if (buffer.trim()) {
        onChunk({ raw: buffer, parsed: buffer });
      }

      onEnd();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        onError(err);
      }
    }
  })();

  return {
    cancel: () => controller.abort(),
  };
}
