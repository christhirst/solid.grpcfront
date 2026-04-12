import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Find all srvx _url.mjs files in node_modules
const findCommand = 'find node_modules -path "*/srvx/dist/_chunks/_url.mjs"';
let files = [];
try {
  files = execSync(findCommand).toString().trim().split('\n').filter(Boolean);
} catch (e) {
  console.error('Error finding files:', e);
  process.exit(1);
}

if (files.length === 0) {
  console.log('No srvx _url.mjs files found to patch.');
  process.exit(0);
}

console.log(`Found ${files.length} files to patch.`);

files.forEach(targetFile => {
  let code = fs.readFileSync(targetFile, 'utf8');

  const searchString = 'this.#url = new NativeURL(this.href);';
  const replacementString = 'this.#url = new NativeURL(this.href.startsWith(\'/\') ? `http://localhost${this.href}` : this.href);';

  if (code.includes(replacementString)) {
    console.log(`- ${targetFile}: already patched.`);
    return;
  }

  if (code.includes(searchString)) {
    code = code.replace(new RegExp(searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementString);
    fs.writeFileSync(targetFile, code);
    console.log(`- ${targetFile}: Successfully patched.`);
  } else {
    // Try matching without the semicolon or with different spacing if needed
    // But based on grep, it should match.
    console.warn(`- ${targetFile}: Could not find the exact target line.`);
  }
});
