import { describe, expect, it, mock } from "bun:test";

// Force the client runtime build of solid-js so createResource executes with
// reactive tracking and Suspense context rather than the non-reactive SSR build.
const solidClient = await import("solid-js/dist/solid.js" as string);
mock.module("solid-js", () => solidClient);

const { createRoot, createComputed, Suspense } = solidClient;
const { createClientResource } = await import("./clientResource");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 0));

describe("createClientResource", () => {
  it("loads initial data, tracks initial loading, and preserves data without reloading during refetch", async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    let callCount = 0;

    let resource!: ReturnType<typeof createClientResource<string[]>>[0];
    let refetch!: ReturnType<typeof createClientResource<string[]>>[1]["refetch"];
    let dispose!: () => void;

    createRoot((d) => {
      dispose = d;
      [resource, { refetch }] = createClientResource(async () => {
        callCount += 1;
        return callCount === 1 ? first.promise : second.promise;
      });
    });

    try {
      expect(resource.loading).toBe(true);
      expect(resource()).toBeUndefined();

      first.resolve(["conn-a"]);
      await flushMicrotasks();

      expect(resource.loading).toBe(false);
      expect(resource()).toEqual(["conn-a"]);

      // Trigger a background refetch (e.g. tab focus / group change)
      refetch();

      // While refetch is in flight, loading stays false and stale data remains visible
      expect(resource.loading).toBe(false);
      expect(resource()).toEqual(["conn-a"]);

      second.resolve(["conn-a", "conn-b"]);
      await flushMicrotasks();

      expect(resource.loading).toBe(false);
      expect(resource()).toEqual(["conn-a", "conn-b"]);
    } finally {
      dispose();
    }
  });

  it("keeps loading true until the first truthy-keyed fetch when initial source key is falsy", async () => {
    const pending = deferred<string[]>();
    let dispose!: () => void;

    const [table, setTable] = solidClient.createSignal<string>("");
    let records!: ReturnType<typeof createClientResource<string[], string>>[0];

    createRoot((d) => {
      dispose = d;
      [records] = createClientResource(
        () => table(),
        async (tbl) => {
          if (!tbl) return [];
          return pending.promise;
        },
        { initialValue: [] }
      );
    });

    try {
      await flushMicrotasks();
      // Selecting first real table should show initial loading
      setTable("users");
      expect(records.loading).toBe(true);

      pending.resolve(["row-1"]);
      await flushMicrotasks();

      expect(records.loading).toBe(false);
      expect(records()).toEqual(["row-1"]);
    } finally {
      dispose();
    }
  });

  it("never activates an ancestor Suspense fallback during initial fetch or refetch", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    let callCount = 0;
    const suspenseEvents: string[] = [];
    let dispose!: () => void;

    createRoot((d) => {
      dispose = d;
      let resource!: ReturnType<typeof createClientResource<string>>[0];
      let refetch!: ReturnType<typeof createClientResource<string>>[1]["refetch"];

      Suspense({
        get fallback() {
          suspenseEvents.push("fallback");
          return "Loading...";
        },
        get children() {
          [resource, { refetch }] = createClientResource(async () => {
            callCount += 1;
            return callCount === 1 ? first.promise : second.promise;
          });
          createComputed(() => {
            suspenseEvents.push(`render:${resource() ?? "empty"}`);
          });
          return "content";
        },
      });

      // Kick off refetch right after first resolves in the test below
      (globalThis as any).__testRefetch = () => refetch();
    });

    try {
      expect(suspenseEvents).not.toContain("fallback");

      first.resolve("v1");
      await flushMicrotasks();
      expect(suspenseEvents).toContain("render:v1");
      expect(suspenseEvents).not.toContain("fallback");

      (globalThis as any).__testRefetch();
      expect(suspenseEvents).not.toContain("fallback");

      second.resolve("v2");
      await flushMicrotasks();
      expect(suspenseEvents).toContain("render:v2");
      expect(suspenseEvents).not.toContain("fallback");
    } finally {
      delete (globalThis as any).__testRefetch;
      dispose();
    }
  });
});
