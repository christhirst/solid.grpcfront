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
            <script
              innerHTML={`try{const theme=localStorage.getItem("solidflow-theme")==="light"?"light":"dark";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch{document.documentElement.dataset.theme="dark"}`}
            />
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
