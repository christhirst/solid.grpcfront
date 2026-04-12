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
