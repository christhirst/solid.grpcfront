// Patch server globals so relative URLs work when the incoming request is path-only.
// This is needed behind reverse proxies / app service runtimes that pass requests like "/about".
const NativeURL = globalThis.URL;
if (typeof NativeURL === "function" && !NativeURL._relativePathNormalized) {
  class URLWithRelativeBase extends NativeURL {
    constructor(input, base) {
      if (typeof input === "string" && input.startsWith("/") && base == null) {
        input = "http://localhost" + input;
      }
      super(input, base);
    }
  }
  Object.defineProperty(URLWithRelativeBase, "_relativePathNormalized", {
    value: true,
  });
  globalThis.URL = URLWithRelativeBase;
}

// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

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
