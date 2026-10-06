import { defineConfig, loadEnv } from "vite";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);
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
    resolve: {
      alias: [
        {
          find: /^elkjs$/,
          replacement: fileURLToPath(new URL("./node_modules/elkjs/lib/elk.bundled.js", import.meta.url)),
        },
      ],
    },
    optimizeDeps: {
      include: [
        "rete",
        "rete-area-plugin",
        "rete-connection-plugin",
        "rete-auto-arrange-plugin",
        "solid-rete-plugin",
      ],
    },
    build: {
      target: "esnext",
      rollupOptions: {
        output: isSsrBuild
          ? {}
          : {
              manualChunks(id) {
                if (id.includes("node_modules")) {
                  if (id.includes("rete") || id.includes("elkjs")) return "vendor-rete";
                  if (id.includes("chart.js") || id.includes("chartjs") || id.includes("solid-chartjs")) return "vendor-charts";
                  if (id.includes("@antv")) return "vendor-antv";
                  if (id.includes("protobufjs")) return "vendor-proto";
                  if (id.includes("jsonata")) return "vendor-jsonata";
                }
              },
            },
      },
    },
    server: {
      port: env.PORT ? parseInt(env.PORT, 10) : 3000,
      host: env.HOST || "localhost",
    }
  };
});
