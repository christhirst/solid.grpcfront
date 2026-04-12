// Patch server globals so relative URLs work when the incoming request is path-only.
// This is needed behind reverse proxies / app service runtimes that pass requests like "/about".
const NativeURL = globalThis.URL as any;
if (typeof NativeURL === "function" && !NativeURL._relativePathNormalized) {
  class URLWithRelativeBase extends NativeURL {
    constructor(input: any, base?: any) {
      if (typeof input === "string" && input.startsWith("/") && base == null) {
        input = `http://localhost${input}`;
      }
      super(input, base);
    }
  }
  Object.defineProperty(URLWithRelativeBase, "_relativePathNormalized", {
    value: true,
  });
  globalThis.URL = URLWithRelativeBase as unknown as typeof URL;
}

const NativeRequest = globalThis.Request as any;
if (typeof NativeRequest === "function" && !NativeRequest._relativePathNormalized) {
  class RequestWithRelativeBase extends NativeRequest {
    constructor(input: any, init?: any) {
      if (typeof input === "string" && input.startsWith("/")) {
        input = `http://localhost${input}`;
      }
      super(input, init);
    }
  }
  Object.defineProperty(RequestWithRelativeBase, "_relativePathNormalized", {
    value: true,
  });
  globalThis.Request = RequestWithRelativeBase as unknown as typeof Request;
}
