import { defineConfig, loadEnv } from "vite";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "rollup";

/**
 * Patches srvx's FastURL so it can handle relative paths like "/" that Nitro's
 * localFetch passes through. FastURL stores the raw href and later calls
 * new NativeURL(href) which crashes on relative URLs in Bun/Node.
 * We prepend a dummy origin when the URL is relative so it always parses.
 */
function srvxFastURLPatch(): Plugin {
  return {
    name: "srvx-fasturl-patch",
    transform(code, id) {
      // Match both the external srvx module and the inlined version in entry chunks
      if (!code.includes("FastURL") || !code.includes("NativeURL")) return null;
      // Patch the _url getter: before calling new NativeURL(this.href), ensure href is absolute
      const patched = code.replace(
        /this\.#url = new NativeURL\(this\.href\);/g,
        `const _href = this.href; this.#url = new NativeURL(_href.startsWith("/") ? \`http://localhost\${_href}\` : _href);`
      );
      if (patched === code) return null;
      return { code: patched, map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      solidStart(),
      tailwindcss(),
      nitro({
        preset: "node-server",
        externals: { inline: ["srvx"] },
        rollupConfig: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          plugins: [srvxFastURLPatch() as any],
        },
      })
    ],
    server: {
      port: env.PORT ? parseInt(env.PORT, 10) : 3000,
      host: env.HOST || "localhost",
    }
  };
});
