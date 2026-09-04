import { getDynamicOrigin, createDynamicRequest, DEFAULT_OIDC_REDIRECT_URI } from "../src/lib/authUrl";

console.log("=== Testing Dynamic OIDC Redirect URL Resolution ===\n");

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

// Test 1: X-Forwarded-Proto and X-Forwarded-Host (Civo / K8s Ingress)
{
  const req = new Request("http://localhost:3000/api/auth/signin/oidc", {
    headers: {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com",
    },
  });
  const origin = getDynamicOrigin(req);
  assert(
    origin === "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com",
    `X-Forwarded headers resolved correctly: ${origin}`
  );

  const { request: dynamicReq, dynamicUrl } = createDynamicRequest(req);
  assert(
    dynamicUrl === "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/api/auth/signin/oidc",
    `Dynamic Request URL matches expected: ${dynamicUrl}`
  );
  assert(
    dynamicReq.url === "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/api/auth/signin/oidc",
    `Rewritten Request object url matches: ${dynamicReq.url}`
  );
}

// Test 2: Custom domain through reverse proxy
{
  const req = new Request("http://127.0.0.1:3000/api/auth/signin/oidc", {
    headers: {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "solidflow.custom-domain.org",
      host: "127.0.0.1:3000",
    },
  });
  const origin = getDynamicOrigin(req);
  assert(
    origin === "https://solidflow.custom-domain.org",
    `Custom domain resolved correctly: ${origin}`
  );

  const { dynamicUrl } = createDynamicRequest(req);
  assert(
    dynamicUrl === "https://solidflow.custom-domain.org/api/auth/signin/oidc",
    `Custom domain dynamic request URL: ${dynamicUrl}`
  );
}

// Test 3: Multiple comma-separated X-Forwarded-Host values (e.g. nested proxies)
{
  const req = new Request("http://localhost:3000/api/auth/callback/oidc?code=abc&state=xyz", {
    headers: {
      "x-forwarded-proto": "https, http",
      "x-forwarded-host": "401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com, proxy2.internal",
    },
  });
  const origin = getDynamicOrigin(req);
  assert(
    origin === "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com",
    `Multiple comma-separated forwarded headers parsed first entry: ${origin}`
  );

  const { dynamicUrl } = createDynamicRequest(req);
  assert(
    dynamicUrl === "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/api/auth/callback/oidc?code=abc&state=xyz",
    `Callback URL preserved query params: ${dynamicUrl}`
  );
}

// Test 4: Origin header from browser POST request
{
  const req = new Request("http://0.0.0.0:3000/api/auth/signin/oidc", {
    method: "POST",
    headers: {
      origin: "https://raynkami-solid-grpcfront.sliplane.app",
    },
  });
  const origin = getDynamicOrigin(req);
  assert(
    origin === "https://raynkami-solid-grpcfront.sliplane.app",
    `Origin header resolved: ${origin}`
  );
}

// Test 5: Default fallback to OIDC_REDIRECT_URI when internal localhost without headers
{
  const req = new Request("http://localhost:3000/api/auth/signin/oidc");
  const origin = getDynamicOrigin(req);
  assert(
    origin === "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com",
    `Internal localhost falls back to default OIDC_REDIRECT_URI: ${origin}`
  );
}

// Test 6: POST request with body preserved
{
  const bodyText = JSON.stringify({ csrfToken: "12345", callbackUrl: "/workflows" });
  const req = new Request("http://localhost:3000/api/auth/signin/oidc", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com",
    },
    body: bodyText,
  });
  const { request: dynamicReq } = createDynamicRequest(req);
  assert(dynamicReq.method === "POST", "POST method preserved");
  assert(dynamicReq.headers.get("content-type") === "application/json", "Headers preserved");
}

console.log("\n🎉 All dynamic OIDC redirect unit tests passed successfully!");
