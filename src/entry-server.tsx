// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler((event) => {
  // Reconstruct the proper URL when behind a reverse proxy
  if (!event.request.url.includes("://")) {
    const proto = event.request.headers.get("x-forwarded-proto") || "https";
    const host = event.request.headers.get("x-forwarded-host") || 
                 event.request.headers.get("host") || 
                 "localhost";
    const pathname = new URL(event.request.url, "http://localhost").pathname;
    const search = new URL(event.request.url, "http://localhost").search;
    const url = `${proto}://${host}${pathname}${search}`;
    
    const newRequest = new Request(url, {
      method: event.request.method,
      headers: event.request.headers,
      body: event.request.body,
    });
    
    Object.defineProperty(event, "request", {
      value: newRequest,
      writable: true,
    });
  }

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
