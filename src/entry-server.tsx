// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

// Patch server globals so relative URLs work when the incoming request is path-only.
// This is needed behind reverse proxies / app service runtimes that pass requests like "/about".
const NativeURL = globalThis.URL as any;
if (typeof NativeURL === "function" && !NativeURL._relativePathNormalized) {
  class URLWithRelativeBase extends NativeURL {
    constructor(input: any, base?: any) {
      if (typeof input === "string" && input.startsWith("/") && base == null) {
        input = `http://localhost${input}`;
      }
      super(input, base);
    }
  }
  Object.defineProperty(URLWithRelativeBase, "_relativePathNormalized", {
    value: true,
  });
  globalThis.URL = URLWithRelativeBase as unknown as typeof URL;
}

const NativeRequest = globalThis.Request as any;
if (typeof NativeRequest === "function" && !NativeRequest._relativePathNormalized) {
  class RequestWithRelativeBase extends NativeRequest {
    constructor(input: any, init?: any) {
      if (typeof input === "string" && input.startsWith("/")) {
        input = `http://localhost${input}`;
      } else if (
        input instanceof NativeRequest &&
        typeof input.url === "string" &&
        input.url.startsWith("/")
      ) {
        const url = `http://localhost${input.url}`;
        super(url, {
          method: input.method,
          headers: input.headers,
          body: init?.body ?? input.body,
          signal: init?.signal ?? input.signal,
          redirect: init?.redirect ?? input.redirect,
          credentials: init?.credentials,
          cache: init?.cache,
          integrity: init?.integrity,
          keepalive: init?.keepalive,
          referrer: init?.referrer,
          referrerPolicy: init?.referrerPolicy,
          mode: init?.mode,
          ...init,
        });
        return;
      }
      super(input, init);
    }
  }
  Object.defineProperty(RequestWithRelativeBase, "_relativePathNormalized", {
    value: true,
  });
  globalThis.Request = RequestWithRelativeBase as unknown as typeof Request;
}

export default createHandler((event) => {
  return (
    <StartServer
      document={({ assets, children, scripts }) => (
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
            {assets}
          </head>
          <body>
            <div id="app">{children}</div>
            {scripts}
          </body>
        </html>
      )}
    />
  );
});
