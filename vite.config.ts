import { defineConfig, loadEnv } from "vite";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      solidStart(),
      tailwindcss(),
      {
        name: "global-url-patcher",
        transform(code, id) {
          // Target all JS/TS files in node_modules and src
          if (/\.(js|mjs|ts|tsx)$/.test(id)) {
            const patched = code.replace(
              /new URL\(([^)]*url)\)/g,
              (match, p1) => {
                // Skip if already patched, or if it's not a single-argument URL constructor
                if (p1.includes("startsWith") || p1.includes(",")) return match;
                return `new URL(${p1}.startsWith('/') ? 'http://localhost' + ${p1} : ${p1})`;
              }
            );
            if (patched !== code) {
              return { code: patched, map: null };
            }
          }
        },
      },
      nitro({
        preset: "bun",
        // Force srvx to be inlined to simplify the bundle, 
        // though our postinstall script handles it in node_modules anyway.
        externals: { inline: ["srvx"] },
        handlers: [
          { route: "/health", handler: "src/server/routes/health.ts" }
        ],
      })
    ],
    server: {
      port: env.PORT ? parseInt(env.PORT, 10) : 3000,
      host: env.HOST || "localhost",
    }
  };
});
