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
          // Target all JS/TS files
          if (/\.(js|mjs|ts|tsx)$/.test(id)) {
            let patched = code;
            
            // Replace new URL() calls with proper handling
            patched = patched.replace(
              /new URL\(([^,)]+)\)/g,
              (match, arg) => {
                // Skip if already has protocol check or multiple args
                if (arg.includes("?") || arg.includes("startsWith")) return match;
                
                const trimmedArg = arg.trim();
                
                // If it's a string literal starting with /, make it a full URL
                if (trimmedArg.startsWith("'") || trimmedArg.startsWith('"')) {
                  const quote = trimmedArg[0];
                  if (trimmedArg.includes(`${quote}/${quote}`)) {
                    // It's a path like '/about', prepend http://localhost
                    return `new URL('http://localhost' + ${trimmedArg})`;
                  }
                }
                
                // For variables, add runtime check
                return `new URL(${trimmedArg}.startsWith('/') ? 'http://localhost' + ${trimmedArg} : ${trimmedArg})`;
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
