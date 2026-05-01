import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, "..");
const serverDir = path.join(rootDir, ".output", "server");
const publicDir = path.join(rootDir, ".output", "public");

// 1. Patch dependencies in node_modules BEFORE or AFTER build
const patchNodeModules = () => {
    const solidJsDistDir = path.join(rootDir, "node_modules", "solid-js", "dist");
    if (!fs.existsSync(solidJsDistDir)) return;

    const filesToPatch = ["solid.js", "dev.js", "server.js", "solid.cjs", "server.cjs"];
    
    for (const file of filesToPatch) {
        const fullPath = path.join(solidJsDistDir, file);
        if (fs.existsSync(fullPath)) {
            let code = fs.readFileSync(fullPath, "utf8");
            let changed = false;

            if (code.includes("Effects.push.apply(Effects, e)")) {
                code = code.replace(
                    /function resumeEffects\(e\) \{\s*Effects\.push\.apply\(Effects, e\);\s*e\.length = 0;\s*\}/g,
                    `function resumeEffects(e) {
  if (Effects) Effects.push.apply(Effects, e);
  else e.forEach(updateComputation);
  e.length = 0;
}`,
                );
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(fullPath, code);
                console.log(`Patched node_modules: ${fullPath}`);
            }
        }
    }
};

// 2. Patch the auth library in the built output
const patchAuthLibrary = () => {
    const authWebPath = path.join(serverDir, "node_modules", "@auth", "core", "lib", "utils", "web.js");
    const authIndexPath = path.join(serverDir, "node_modules", "@auth", "core", "index.js");

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
        console.log("Auth library patched successfully in .output");
    }

    if (fs.existsSync(authIndexPath)) {
        let indexCode = fs.readFileSync(authIndexPath, "utf8");
        indexCode = indexCode.replace(
            /request\.headers\?\.has\((['"])X-Auth-Return-Redirect\1\)/g,
            `(typeof request.headers?.has === 'function' ? request.headers.has("X-Auth-Return-Redirect") : ("x-auth-return-redirect" in (request.headers || {})))`,
        );
        fs.writeFileSync(authIndexPath, indexCode);
        console.log("Auth index patched successfully in .output");
    }
};

// 3. Patch all server files recursively
const patchMjsFiles = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            patchMjsFiles(fullPath);
        } else if (file.endsWith(".mjs") || file.endsWith(".js")) {
            let code = fs.readFileSync(fullPath, "utf8");
            let changed = false;

            // Fix parseCookies crash in Bun
            const parseCookiesRegex = /function parseCookies\(event\) \{\s*return parse\(event\.req\.headers\.get\("cookie"\) \|\| ""\);\s*\}/g;
            if (parseCookiesRegex.test(code)) {
                code = code.replace(parseCookiesRegex, `function parseCookies(event) {
          let cookieHeader;
          const headers = event.req.headers;
          if (headers && typeof headers.get === 'function') {
            cookieHeader = headers.get("cookie") || "";
          } else if (headers && typeof headers === 'object') {
            cookieHeader = headers.cookie || headers["cookie"] || "";
          } else {
            cookieHeader = "";
          }
          return parse(cookieHeader);
        }`);
                changed = true;
            }

            // Global safety net for *.headers.get and *.headers.has
            // Precise regex to avoid breaking sourceEvent.request.headers.get
            const headerGetRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\.headers\.get\((['"])([^'"]+)\2\)/g;
            if (headerGetRegex.test(code)) {
                code = code.replace(headerGetRegex, (match, obj, quote, name) => {
                    return `(typeof ${obj}.headers.get === 'function' ? ${obj}.headers.get("${name}") : (${obj}.headers["${name.toLowerCase()}"] || ${obj}.headers["${name}"]))`;
                });
                changed = true;
            }
            const headerHasRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\.headers\.has\((['"])([^'"]+)\2\)/g;
            if (headerHasRegex.test(code)) {
                code = code.replace(headerHasRegex, (match, obj, quote, name) => {
                    return `(typeof ${obj}.headers.has === 'function' ? ${obj}.headers.has("${name}") : ("${name.toLowerCase()}" in ${obj}.headers || "${name}" in ${obj}.headers))`;
                });
                changed = true;
            }

            // Fix getDefaultExportFromNamespaceIfNotNamed for Bun built-ins
            const brokenHelper = /function getDefaultExportFromNamespaceIfNotNamed \(n\) \{\s*return n && Object\.prototype\.hasOwnProperty\.call\(n, 'default'\) && Object\.keys\(n\)\.length === 1 \? n\['default'\] : n;\s*\}/g;
            if (brokenHelper.test(code)) {
                code = code.replace(brokenHelper, `function getDefaultExportFromNamespaceIfNotNamed (n) {
          if (n && typeof n === 'object' && n.default) return n.default;
          return n;
        }`);
                changed = true;
            }

            // Fix class extensions that might fail in Bun
            if (code.includes("extends events_1.default")) {
                code = code.replace(/extends events_1\.default/g, "extends (events_1.default.EventEmitter || events_1.default)");
                changed = true;
            }

            // Fix FastURL crash in srvx/h3
            if (code.includes("this.#url = new NativeURL(this.href);")) {
                code = code.replace(/this\.#url\s*=\s*new\s+NativeURL\(this\.href\);/g, "this.#url = new NativeURL(this.href.startsWith('/') ? `http://localhost${this.href}` : this.href);");
                changed = true;
            }

            // Fix SolidJS router getPath()
            if (code.includes("const u = new URL(url);") && code.includes("function getPath(url)")) {
                code = code.replace(/const u = new URL\(url\);/g, "const u = new URL(url.startsWith('/') ? 'http://localhost' + url : url);");
                changed = true;
            }

            // Generic safety net for new URL(variable)
            const genericURLRegex = /(=|\(|\s)new URL\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)(?!,)/g;
            if (genericURLRegex.test(code)) {
                code = code.replace(genericURLRegex, `$1new URL($2 && typeof $2 === 'string' && $2.startsWith('/') ? 'http://localhost' + $2 : $2)`);
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(fullPath, code);
                console.log(`Patched: ${fullPath}`);
            }
        }
    }
};

// 4. Patch client-side SolidJS web module
const patchClientAssets = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            patchClientAssets(fullPath);
        } else if (file.startsWith("web-") && file.endsWith(".js")) {
            let code = fs.readFileSync(fullPath, "utf8");
            let changed = false;

            const pushRegex = /function ([a-zA-Z_$][a-zA-Z0-9_$]*)\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\{([a-zA-Z_$][a-zA-Z0-9_$]*)\.push\.apply\(\3,\2\),\2\.length=0\}/g;
            if (pushRegex.test(code)) {
                code = code.replace(pushRegex, (match, fnName, argName, effectsName) => {
                    return `function ${fnName}(${argName}){if(${effectsName}){${effectsName}.push.apply(${effectsName},${argName})}else{${argName}.forEach(q)}${argName}.length=0}`;
                });
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(fullPath, code);
                console.log(`Patched client-side web module: ${fullPath}`);
            }
        }
    }
};

// Main Execution
console.log("Starting build patching...");
patchNodeModules();
if (fs.existsSync(serverDir)) {
    patchAuthLibrary();
    patchMjsFiles(serverDir);
}
if (fs.existsSync(publicDir)) {
    patchClientAssets(publicDir);
}

// 5. Generate instrument.server.mjs
const instrumentPath = path.join(serverDir, "instrument.server.mjs");
const instrumentCode = `
const originalURL = globalThis.URL;
globalThis.URL = function(input, base) {
  if (typeof input === 'string' && input.startsWith('/') && base == null) {
    input = 'http://localhost' + input;
  }
  try {
    return new originalURL(input, base);
  } catch (e) {
    if (typeof input !== 'string') {
        try { return new originalURL(String(input), base); } catch(e2) { return new originalURL('http://localhost'); }
    }
    throw e;
  }
};
globalThis.URL.prototype = originalURL.prototype;
Object.setPrototypeOf(globalThis.URL, originalURL);

const originalFetch = globalThis.fetch;
globalThis.fetch = function(input, init) {
  if (typeof input === 'string' && input.startsWith('/')) {
    input = \`http://localhost:\${process.env.PORT || 3000}\${input}\`;
  } else if (input instanceof URL && input.pathname.startsWith('/') && input.hostname === 'localhost' && !input.port) {
    input.port = process.env.PORT || "3000";
  }
  return originalFetch.call(this, input, init);
};
`;

if (fs.existsSync(serverDir)) {
    fs.writeFileSync(instrumentPath, instrumentCode);
    console.log("Generated instrument.server.mjs");
}
