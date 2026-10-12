import { describe, expect, it } from "bun:test";
import { readJsonBody } from "./requestUtils";

describe("readJsonBody", () => {
  it("returns parsed object from standard Web Request with .json()", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hello: "world", count: 42 }),
    });

    const result = await readJsonBody(req);
    expect(result).toEqual({ hello: "world", count: 42 });
  });

  it("handles event object containing event.request", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish", namespace: "my-ns" }),
    });
    const event = { request: req };

    const result = await readJsonBody(event);
    expect(result).toEqual({ action: "publish", namespace: "my-ns" });
  });

  it("handles event when req.json is undefined but req.body is a ReadableStream (H3 / Node adapter)", async () => {
    const stream = new Response(JSON.stringify({ user: "admin", role: "editor" })).body;
    const mockAdapter = {
      // simulate H3/Node incoming message adapter where req.json is undefined
      body: stream,
    };
    const event = { request: mockAdapter };

    const result = await readJsonBody(event);
    expect(result).toEqual({ user: "admin", role: "editor" });
  });

  it("handles req.body that is already parsed as an object", async () => {
    const parsedData = { status: "success", items: [1, 2, 3] };
    const event = {
      request: {
        body: parsedData,
      },
    };

    const result = await readJsonBody(event);
    expect(result).toEqual(parsedData);
  });

  it("handles req.body that is a raw string", async () => {
    const event = {
      request: {
        body: JSON.stringify({ slug: "test-slug" }),
      },
    };

    const result = await readJsonBody(event);
    expect(result).toEqual({ slug: "test-slug" });
  });

  it("handles req.body that is a Buffer", async () => {
    const buffer = Buffer.from(JSON.stringify({ bufferData: true }));
    const event = {
      request: {
        body: buffer,
      },
    };

    const result = await readJsonBody(event);
    expect(result).toEqual({ bufferData: true });
  });

  it("returns empty object safely if event or request is null or empty", async () => {
    expect(await readJsonBody<Record<string, any>>(null)).toEqual({});
    expect(await readJsonBody<Record<string, any>>(undefined)).toEqual({});
    expect(await readJsonBody<Record<string, any>>({})).toEqual({});
  });

  it("falls back to empty object on invalid JSON body without throwing", async () => {
    const event = {
      request: {
        body: "invalid-json-string{",
      },
    };

    const result = await readJsonBody(event);
    expect(result).toEqual({});
  });
});
