async function executeHttpStreamCall(params, onChunk, onError, onEnd) {
  const controller = new AbortController();
  const {
    url,
    method = "GET",
    headers = {},
    body,
    tls
  } = params;
  let requestUrl = url;
  if (requestUrl && !requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
    const separator = requestUrl.startsWith("/") ? "" : "/";
    const port = process.env.PORT || 3e3;
    requestUrl = `http://127.0.0.1:${port}${separator}${requestUrl}`;
  }
  (async () => {
    try {
      const fetchHeaders = {
        ...headers
      };
      let fetchBody = void 0;
      if (body !== void 0 && method !== "GET" && method !== "DELETE") {
        if (typeof body === "object") {
          fetchBody = JSON.stringify(body);
          if (!fetchHeaders["Content-Type"]) fetchHeaders["Content-Type"] = "application/json";
        } else {
          fetchBody = String(body);
        }
      }
      const fetchOptions = {
        method,
        headers: fetchHeaders,
        body: fetchBody,
        signal: controller.signal
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
        const {
          done,
          value
        } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, {
          stream: true
        });
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
            let parsed = eventData;
            try {
              parsed = JSON.parse(eventData);
            } catch {
            }
            onChunk({
              raw: rawBlock,
              parsed: {
                event: eventType,
                data: parsed
              }
            });
          }
        } else {
          let parsed = buffer;
          try {
            parsed = JSON.parse(buffer);
          } catch {
          }
          onChunk({
            raw: text,
            parsed
          });
        }
      }
      if (buffer.trim()) {
        onChunk({
          raw: buffer,
          parsed: buffer
        });
      }
      onEnd();
    } catch (err) {
      if (err.name !== "AbortError") {
        onError(err);
      }
    }
  })();
  return {
    cancel: () => controller.abort()
  };
}
export {
  executeHttpStreamCall as e
};
//# sourceMappingURL=httpExecutor-C7gv4kID.js.map
