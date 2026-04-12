import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, '..', '.output', 'server', 'index.mjs');
const authWebPath = path.join(__dirname, '..', '.output', 'server', 'node_modules', '@auth', 'core', 'lib', 'utils', 'web.js');

console.log('Server path:', serverPath);
console.log('Auth web path:', authWebPath);
console.log('Server file exists:', fs.existsSync(serverPath));
console.log('Auth web file exists:', fs.existsSync(authWebPath));

// Patch the auth library first
if (fs.existsSync(authWebPath)) {
  let authCode = fs.readFileSync(authWebPath, 'utf8');
  console.log('Auth code original size:', authCode.length);
  
  authCode = authCode.replace(
    /headers: Object\.fromEntries\(req\.headers\)/,
    `headers: Object.fromEntries(typeof req.headers.entries === 'function' ? req.headers.entries() : Object.entries(req.headers || {}))`
  );
  
  fs.writeFileSync(authWebPath, authCode);
  console.log('Auth library patched successfully');
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