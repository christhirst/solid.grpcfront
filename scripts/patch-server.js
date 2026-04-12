import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, '..', '.output', 'server', 'index.mjs');

console.log('Server path:', serverPath);
console.log('File exists:', fs.existsSync(serverPath));

// Read the server bundle
let serverCode = fs.readFileSync(serverPath, 'utf8');
console.log('Original file size:', serverCode.length);
console.log('Original first 100 chars:', serverCode.substring(0, 100));

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