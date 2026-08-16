import get from "lodash.get";
async function POST(event) {
  try {
    const body = await new Response(event.request.body).json();
    const {
      url,
      method,
      body: reqBody,
      headers: reqHeaders,
      authScheme,
      username,
      password,
      bearerToken,
      tokenPath
    } = body;
    if (!url) {
      return new Response(JSON.stringify({
        success: false,
        error: "URL is required"
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const headers = {
      "Content-Type": "application/json"
    };
    if (reqHeaders) {
      try {
        const parsed = JSON.parse(reqHeaders);
        Object.assign(headers, parsed);
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to parse custom headers: ${e.message}`
        }), {
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
    }
    if (authScheme === "basic" && (username || password)) {
      const auth = Buffer.from(`${username || ""}:${password || ""}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    } else if (authScheme === "bearer" && bearerToken) {
      headers["Authorization"] = `Bearer ${bearerToken}`;
    }
    let targetUrl = url;
    if (targetUrl && !targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      const separator = targetUrl.startsWith("/") ? "" : "/";
      const port = process.env.PORT || 3e3;
      targetUrl = `http://127.0.0.1:${port}${separator}${targetUrl}`;
    }
    const fetchOptions = {
      method: method || "POST",
      headers
    };
    if (method !== "GET") {
      fetchOptions.body = reqBody || void 0;
    }
    const res = await fetch(targetUrl, fetchOptions);
    let resData;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      resData = await res.json();
    } else {
      const text = await res.text();
      try {
        resData = JSON.parse(text);
      } catch {
        resData = text;
      }
    }
    if (!res.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `HTTP ${res.status}: ${typeof resData === "object" ? JSON.stringify(resData) : resData}`
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const token = get(resData, tokenPath || "access_token");
    return new Response(JSON.stringify({
      success: true,
      token,
      response: resData
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
export {
  POST
};
//# sourceMappingURL=test-token-FSxWnVgd.js.map
