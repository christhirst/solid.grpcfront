import { GET, POST } from "../src/routes/api/auth/[...solidauth]";

console.log("=== Testing SolidAuth Route Handler with Dynamic Origin ===\n");

async function run() {
  // Simulate incoming GET request from reverse proxy for CSRF token
  const req = new Request("http://localhost:3000/api/auth/csrf", {
    method: "GET",
    headers: {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com",
    },
  });

  const event = { request: req };
  const res = await GET(event);
  console.log("CSRF response status:", res?.status);
  const data = await res?.json();
  const setCookie = res?.headers.get("set-cookie") || "";
  console.log("CSRF response data:", data);
  console.log("CSRF set-cookie:", setCookie);

  if (!data?.csrfToken) {
    console.error("❌ Failed to retrieve csrfToken from GET handler");
    process.exit(1);
  }
  console.log("✅ GET /api/auth/csrf returned valid csrfToken");

  // Extract cookie name and value (e.g. authjs.csrf-token=...)
  const cookieHeader = setCookie.split(";")[0] || "";

  // Simulate POST /api/auth/signin/oidc
  const signinReq = new Request("http://localhost:3000/api/auth/signin/oidc", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com",
      "x-auth-return-redirect": "1",
      cookie: cookieHeader,
    },
    body: new URLSearchParams({
      csrfToken: data.csrfToken,
      callbackUrl: "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/workflows",
    }),
  });

  const signinEvent = { request: signinReq };
  const signinRes = await POST(signinEvent);
  console.log("Signin response status:", signinRes?.status);
  const signinData = await signinRes?.json();
  console.log("Signin response data:", signinData);

  if (signinData?.url) {
    console.log("Generated OIDC Auth URL:", signinData.url);
    const parsedUrl = new URL(signinData.url);
    const redirectUriParam = parsedUrl.searchParams.get("redirect_uri");
    console.log("OIDC redirect_uri param in Auth URL:", redirectUriParam);

    if (redirectUriParam === "https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/api/auth/callback/oidc") {
      console.log("✅ SUCCESS: redirect_uri matches dynamic origin https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/api/auth/callback/oidc");
    } else {
      console.error(`❌ FAIL: redirect_uri is ${redirectUriParam}`);
      process.exit(1);
    }
  } else {
    console.error("❌ No redirect URL returned in signin response:", signinData);
    process.exit(1);
  }

  // Also test with another domain to verify full dynamic multi-domain behavior
  {
    const req2 = new Request("http://localhost:3000/api/auth/csrf", {
      method: "GET",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "custom-tenant.domain.com",
      },
    });
    const res2 = await GET({ request: req2 });
    const data2 = await res2?.json();
    const cookie2 = (res2?.headers.get("set-cookie") || "").split(";")[0];

    const signinReq2 = new Request("http://localhost:3000/api/auth/signin/oidc", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "custom-tenant.domain.com",
        "x-auth-return-redirect": "1",
        cookie: cookie2,
      },
      body: new URLSearchParams({
        csrfToken: data2.csrfToken,
        callbackUrl: "/dashboards",
      }),
    });

    const signinRes2 = await POST({ request: signinReq2 });
    const signinData2 = await signinRes2?.json();
    const parsedUrl2 = new URL(signinData2.url);
    const redirectUriParam2 = parsedUrl2.searchParams.get("redirect_uri");
    console.log("Multi-tenant redirect_uri param:", redirectUriParam2);

    if (redirectUriParam2 === "https://custom-tenant.domain.com/api/auth/callback/oidc") {
      console.log("✅ SUCCESS: Multi-tenant dynamic redirect_uri resolved correctly!");
    } else {
      console.error(`❌ FAIL: Expected https://custom-tenant.domain.com/api/auth/callback/oidc, got ${redirectUriParam2}`);
      process.exit(1);
    }
  }

  console.log("\n🎉 SolidAuth Route Handler dynamic redirect verification fully successful!");
}

run().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
