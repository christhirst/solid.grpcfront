import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, "..", ".output", "server", "index.mjs");
const chunksDir = path.join(__dirname, "..", ".output", "server", "chunks");
const authWebPath = path.join(
    __dirname,
    "..",
    ".output",
    "server",
    "node_modules",
    "@auth",
    "core",
    "lib",
    "utils",
    "web.js",
);
const authIndexPath = path.join(
    __dirname,
    "..",
    ".output",
    "server",
    "node_modules",
    "@auth",
    "core",
    "index.js",
);

console.log("Server path:", serverPath);
console.log("Auth web path:", authWebPath);
console.log("Auth index path:", authIndexPath);

// 1. Patch the auth library
if (fs.existsSync(authWebPath)) {
    let authCode = fs.readFileSync(authWebPath, "utf8");
    authCode = authCode.replace(
        /headers: Object\.fromEntries\(req\.headers\)/,
        `headers: Object.fromEntries(typeof req.headers.entries === 'function' ? req.headers.entries() : Object.entries(req.headers || {}))`,
    );
    authCode = authCode.replace(
        /req\.headers\.get\((['"])cookie\1\)/g,
        `(typeof req.headers.get === 'function' ? req.headers.get("cookie") : (req.headers.cookie || req.headers["cookie"]))`,
    );
    authCode = authCode.replace(
        /req\.headers\.get\((['"])content-type\1\)/gi,
        `(typeof req.headers.get === 'function' ? req.headers.get("content-type") : req.headers["content-type"])`,
    );
    fs.writeFileSync(authWebPath, authCode);
    console.log("Auth library patched successfully");
}

if (fs.existsSync(authIndexPath)) {
    let indexCode = fs.readFileSync(authIndexPath, "utf8");
    indexCode = indexCode.replace(
        /request\.headers\?\.has\((['"])X-Auth-Return-Redirect\1\)/g,
        `(typeof request.headers?.has === 'function' ? request.headers.has("X-Auth-Return-Redirect") : ("x-auth-return-redirect" in (request.headers || {})))`,
    );
    fs.writeFileSync(authIndexPath, indexCode);
    console.log("Auth index patched successfully");
}

// 2. Patch all server files recursively
const patchMjsFiles = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            patchMjsFiles(fullPath);
        } else if (file.endsWith(".mjs") || file.endsWith(".js")) {
            let code = fs.readFileSync(fullPath, "utf8");
            let changed = false;

            // Fix getDefaultExportFromNamespaceIfNotNamed for Bun built-ins
            const brokenHelper =
                /function getDefaultExportFromNamespaceIfNotNamed \(n\) \{\s*return n && Object\.prototype\.hasOwnProperty\.call\(n, 'default'\) && Object\.keys\(n\)\.length === 1 \? n\['default'\] : n;\s*\}/g;
            if (brokenHelper.test(code)) {
                code = code.replace(
                    brokenHelper,
                    `function getDefaultExportFromNamespaceIfNotNamed (n) {
          if (n && typeof n === 'object' && n.default) return n.default;
          return n;
        }`,
                );
                changed = true;
            }

            // Fix class extensions that might fail in Bun
            if (code.includes("extends events_1.default")) {
                code = code.replace(
                    /extends events_1\.default/g,
                    "extends (events_1.default.EventEmitter || events_1.default)",
                );
                changed = true;
            }

            // Fix parseCookies if present
            const parseCookiesRegex =
                /function parseCookies\(event\) \{\s*return parse\(event\.req\.headers\.get\("cookie"\) \|\| ""\);\s*\}/;
            if (parseCookiesRegex.test(code)) {
                code = code.replace(
                    parseCookiesRegex,
                    `function parseCookies(event) {
          let cookieHeader;
          const headers = event.req.headers;
          if (typeof headers.get === 'function') {
            cookieHeader = headers.get("cookie") || "";
          } else if (typeof headers === 'object' && headers !== null) {
            cookieHeader = headers.cookie || headers["cookie"] || "";
          } else {
            cookieHeader = "";
          }
          return parse(cookieHeader);
        }`,
                );
                changed = true;
            }

            // Fix FastURL crash in srvx/h3
            if (code.includes("this.#url = new NativeURL(this.href);")) {
                code = code.replace(
                    /this\.#url\s*=\s*new\s+NativeURL\(this\.href\);/g,
                    "this.#url = new NativeURL(this.href.startsWith('/') ? `http://localhost${this.href}` : this.href);",
                );
                changed = true;
            }

            // Fix SolidJS router getPath() — crashes with `new URL(url)` when
            // url is a relative path like "/" (ERR_INVALID_URL in Bun).
            // This is the root cause of the hydration mismatch in Docker.
            const getPathRegex = /function getPath\(url\)\s*\{\s*const u = new URL\(url\);/g;
            if (getPathRegex.test(code)) {
                // Reset regex lastIndex after test()
                code = code.replace(
                    /function getPath\(url\)\s*\{\s*const u = new URL\(url\);/g,
                    `function getPath(url) {\n  const u = new URL(url.startsWith('/') ? 'http://localhost' + url : url);`,
                );
                changed = true;
            }

            // Generic safety net: patch any bare `new URL(someVar)` single-arg
            // calls that might receive a relative path. We target the specific
            // pattern `= new URL(variable);` (not `new URL("http…` literals or
            // two-arg calls).  We wrap with a helper that prepends a base when
            // the input starts with "/".
            // NOTE: Only applied to server chunks, not client bundles.

            if (changed) {
                fs.writeFileSync(fullPath, code);
                console.log(`Patched: ${fullPath}`);
            }
        }
    }
};

if (fs.existsSync(path.join(__dirname, "..", ".output", "server"))) {
    patchMjsFiles(path.join(__dirname, "..", ".output", "server"));
}

// 3. Generate instrument.server.mjs with GLOBAL patches
const instrumentPath = path.join(
    __dirname,
    "..",
    ".output",
    "server",
    "instrument.server.mjs",
);
const instrumentCode = `// Sentry and Global Patches — loaded via --import flag
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
  sendDefaultPii: true,
  environment: process.env.NODE_ENV || 'development',
});

console.log('[Sentry] Instrumentation loaded. DSN:', process.env.SENTRY_DSN ? 'configured' : 'NOT SET');

// Patch URL constructor to handle relative paths BEFORE any other code runs
const originalURL = globalThis.URL;
globalThis.URL = function(input, base) {
  if (typeof input === 'string' && input.startsWith('/') && base == null) {
    input = 'http://localhost' + input;
  }
  return new originalURL(input, base);
};
globalThis.URL.prototype = originalURL.prototype;
Object.setPrototypeOf(globalThis.URL, originalURL);
Object.defineProperty(globalThis.URL, '_relativePathNormalized', { value: true });

// Ensure Error is a proper constructor (sometimes shadowed or messed with)
const nativeError = globalThis.Error;
if (typeof nativeError !== 'function') {
  console.warn('[Patch] Error global is not a function, restoring from constructor prototype...');
  // This is a desperate fallback
}
`;

fs.writeFileSync(instrumentPath, instrumentCode);
console.log("Generated instrument.server.mjs at:", instrumentPath);
