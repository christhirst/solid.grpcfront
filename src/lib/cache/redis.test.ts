import { describe, it, expect } from "bun:test";
import { getCache, setCache, delCache, acquireLock, releaseLock, publishEvent, subscribeEvent } from "./redis";

describe("Cache & Distributed Primitives (Redis / In-Memory Fallback)", () => {
  it("stores and retrieves values with setCache and getCache", async () => {
    await setCache("test:key1", "hello world", 60);
    const val = await getCache("test:key1");
    expect(val).toBe("hello world");

    await delCache("test:key1");
    const afterDel = await getCache("test:key1");
    expect(afterDel).toBeNull();
  });

  it("handles atomic lock acquisition and release", async () => {
    const lockKey = "test:lock:123";
    const acquired = await acquireLock(lockKey, 10);
    expect(acquired).toBe(true);

    // Second acquisition should fail because it is locked
    const secondTry = await acquireLock(lockKey, 10);
    expect(secondTry).toBe(false);

    // Releasing allows acquisition again
    await releaseLock(lockKey);
    const thirdTry = await acquireLock(lockKey, 10);
    expect(thirdTry).toBe(true);

    await releaseLock(lockKey);
  });

  it("publishes and subscribes to events", async () => {
    const channel = "test:events:channel";
    const received: string[] = [];

    const unsubscribe = await subscribeEvent(channel, (msg) => {
      received.push(msg);
    });

    await publishEvent(channel, JSON.stringify({ type: "step_start", stepId: "s1" }));
    await publishEvent(channel, JSON.stringify({ type: "step_complete", stepId: "s1" }));

    expect(received.length).toBe(2);
    expect(JSON.parse(received[0]).type).toBe("step_start");
    expect(JSON.parse(received[1]).type).toBe("step_complete");

    unsubscribe();
    await publishEvent(channel, JSON.stringify({ type: "ignored" }));
    expect(received.length).toBe(2); // no new events received after unsubscribe
  });
});
