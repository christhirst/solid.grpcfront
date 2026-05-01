import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, "..");
const serverDir = path.join(rootDir, ".output", "server");
const publicDir = path.join(rootDir, ".output", "public");

// 1. Patch dependencies in node_modules BEFORE or AFTER build
// This ensures that Vite/Rollup pick up the patched version and change the hash,
// bypassing browser caching of the unpatched web-*.js bundle.
const patchNodeModules = () => {
    const solidJsDistDir = path.join(rootDir, "node_modules", "solid-js", "dist");
    if (!fs.existsSync(solidJsDistDir)) return;

    const filesToPatch = ["solid.js", "dev.js", "server.js", "solid.cjs", "server.cjs"];
    
    for (const file of filesToPatch) {
        const fullPath = path.join(solidJsDistDir, file);
        if (fs.existsSync(fullPath)) {
            let code = fs.readFileSync(fullPath, "utf8");
            let changed = false;

            // Fix the infamous "Cannot read properties of null (reading 'push')" in resumeEffects
            // This happens during hydration if a suspense boundary resolves while no batch is active.
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

    // Also patch @auth/core in node_modules if it's there (for dev mode)
    const authCoreDir = path.join(rootDir, "node_modules", "@auth", "core");
    if (fs.existsSync(authCoreDir)) {
        // ... similar patches for auth core if needed in dev ...
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

// 4. Patch client-side SolidJS web module to prevent hydration 'push' crash
// (Used as a fallback if the node_modules patch didn't change the hash yet)
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

            // Minified SolidJS: qe(e){E.push.apply(E,e),e.length=0}
            // We need to be careful with names as they can change.
            // But we know 'E' is the Effects array and 'q' is updateComputation in the current build.
            const pushRegex = /function ([a-zA-Z_$][a-zA-Z0-9_$]*)\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\{([a-zA-Z_$][a-zA-Z0-9_$]*)\.push\.apply\(\3,\2\),\2\.length=0\}/g;
            if (pushRegex.test(code)) {
                code = code.replace(pushRegex, (match, fnName, argName, effectsName) => {
                    console.log(`Detected pushEffects: ${fnName} with arg ${argName} and array ${effectsName}`);
                    // We assume 'q' is updateComputation if we can find it, but for minified code 
                    // it's safer to just guard the push.
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
patchAuthLibrary();
patchMjsFiles(serverDir);
patchClientAssets(publicDir);

// 5. Generate instrument.server.mjs
const instrumentPath = path.join(serverDir, "instrument.server.mjs");
const instrumentCode = `
// GLOBAL URL PATCH
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

console.log('[Patch] Global URL constructor patched.');
`;

if (fs.existsSync(serverDir)) {
    fs.writeFileSync(instrumentPath, instrumentCode);
    console.log("Generated instrument.server.mjs");
}
