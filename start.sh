#!/bin/bash

# Run the patch and server in the same Bun process
# --import loads Sentry instrumentation before any app code
bun --import ./.output/server/instrument.server.mjs -e "
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

// Now import and run the server
import('./.output/server/index.mjs');
"