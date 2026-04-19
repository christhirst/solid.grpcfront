import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, '..', '.output', 'server', 'index.mjs');
const authWebPath = path.join(__dirname, '..', '.output', 'server', 'node_modules', '@auth', 'core', 'lib', 'utils', 'web.js');
const authIndexPath = path.join(__dirname, '..', '.output', 'server', 'node_modules', '@auth', 'core', 'index.js');

console.log('Server path:', serverPath);
console.log('Auth web path:', authWebPath);
console.log('Auth index path:', authIndexPath);
console.log('Server file exists:', fs.existsSync(serverPath));
console.log('Auth web file exists:', fs.existsSync(authWebPath));
console.log('Auth index file exists:', fs.existsSync(authIndexPath));

// Patch the auth library first
if (fs.existsSync(authWebPath)) {
  let authCode = fs.readFileSync(authWebPath, 'utf8');
  console.log('Auth code original size:', authCode.length);
  
  authCode = authCode.replace(
    /headers: Object\.fromEntries\(req\.headers\)/,
    `headers: Object.fromEntries(typeof req.headers.entries === 'function' ? req.headers.entries() : Object.entries(req.headers || {}))`
  );
  
  authCode = authCode.replace(
    /req\.headers\.get\((['"])cookie\1\)/g,
    `(typeof req.headers.get === 'function' ? req.headers.get("cookie") : (req.headers.cookie || req.headers["cookie"]))`
  );
  
  authCode = authCode.replace(
    /req\.headers\.get\((['"])content-type\1\)/gi,
    `(typeof req.headers.get === 'function' ? req.headers.get("content-type") : req.headers["content-type"])`
  );
  
  fs.writeFileSync(authWebPath, authCode);
  console.log('Auth library patched successfully');
}

if (fs.existsSync(authIndexPath)) {
  let indexCode = fs.readFileSync(authIndexPath, 'utf8');
  console.log('Auth index original size:', indexCode.length);
  
  indexCode = indexCode.replace(
    /request\.headers\?\.has\((['"])X-Auth-Return-Redirect\1\)/g,
    `(typeof request.headers?.has === 'function' ? request.headers.has("X-Auth-Return-Redirect") : ("x-auth-return-redirect" in (request.headers || {})))`
  );
  
  fs.writeFileSync(authIndexPath, indexCode);
  console.log('Auth index patched successfully');
}

// Read the server bundle
let serverCode = fs.readFileSync(serverPath, 'utf8');
console.log('Server code original size:', serverCode.length);

// Replace the parseCookies function implementation
const parseCookiesRegex = /function parseCookies\(event\) \{\s*return parse\(event\.req\.headers\.get\("cookie"\) \|\| ""\);\s*\}/;
const parseCookiesReplacement = `function parseCookies(event) {
        let cookieHeader;
        const headers = event.req.headers;
        if (typeof headers.get === 'function') {
                // Headers object
                cookieHeader = headers.get("cookie") || "";
        } else if (typeof headers === 'object' && headers !== null) {
                // Plain object
                cookieHeader = headers.cookie || headers["cookie"] || "";
        } else {
                cookieHeader = "";
        }
        return parse(cookieHeader);
}`;

serverCode = serverCode.replace(parseCookiesRegex, parseCookiesReplacement);

// Remove the auth patch from server code since we're patching the auth library directly
serverCode = serverCode.replace(
  /headers: Object\.fromEntries\(typeof req\.headers\.entries === 'function' \? req\.headers\.entries\(\) : Object\.entries\(req\.headers \|\| \{\}\)\)/,
  `headers: Object.fromEntries(req.headers)`
);

// Inject the URL patch at the very beginning
const patchCode = `
// Patch URL constructor to handle relative paths
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

`;

serverCode = patchCode + serverCode;
console.log('New file size:', serverCode.length);
console.log('New first 200 chars:', serverCode.substring(0, 200));

// Write back the modified server bundle
fs.writeFileSync(serverPath, serverCode);

console.log('Server bundle patched successfully');

// Verify the file was written
const verifyCode = fs.readFileSync(serverPath, 'utf8');
console.log('Verified file size:', verifyCode.length);
console.log('Verified first 200 chars:', verifyCode.substring(0, 200));

// ---------------------------------------------------------------------------
// Generate instrument.server.mjs for Sentry --import flag
// ---------------------------------------------------------------------------
const instrumentPath = path.join(__dirname, '..', '.output', 'server', 'instrument.server.mjs');
const instrumentCode = `// Sentry server-side instrumentation — loaded via --import flag before app code
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
  sendDefaultPii: true,
  environment: process.env.NODE_ENV || 'development',
});

console.log('[Sentry] Instrumentation loaded. DSN:', process.env.SENTRY_DSN ? 'configured' : 'NOT SET');
`;

fs.writeFileSync(instrumentPath, instrumentCode);
console.log('Generated instrument.server.mjs at:', instrumentPath);