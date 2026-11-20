import { describe, it, expect, afterEach } from "bun:test";
import { EventEmitter } from "node:events";
import {
  getCache,
  setCache,
  delCache,
  acquireLock,
  releaseLock,
  publishEvent,
  subscribeEvent,
  _setRedisClientsForTest,
} from "./redis";

describe("Cache & Distributed Primitives (Redis / In-Memory Fallback)", () => {
  afterEach(() => {
    _setRedisClientsForTest(null, null);
  });

  it("stores and retrieves values with setCache and getCache", async () => {
    await setCache("test:key1", "hello world", 60);
    const val = await getCache("test:key1");
    expect(val).toBe("hello world");

    await delCache("test:key1");
    const afterDel = await getCache("test:key1");
    expect(afterDel).toBeNull();
  });

  it("does not return expired cache entries or expired locks", async () => {
    await setCache("test:expired", "stale", 0.01);
    const lockOk = await acquireLock("test:lock:short", 0.01);
    expect(lockOk).toBe(true);

    await new Promise((r) => setTimeout(r, 25));

    expect(await getCache("test:expired")).toBeNull();
    // Expired lock can be re-acquired without explicit release
    expect(await acquireLock("test:lock:short", 10)).toBe(true);
    await releaseLock("test:lock:short");
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

  it("publishes and subscribes to events without disturbing sibling subscribers on unsubscribe", async () => {
    const channel = "test:events:channel";
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    const unsubA = await subscribeEvent(channel, (msg) => receivedA.push(msg));
    const unsubB = await subscribeEvent(channel, (msg) => receivedB.push(msg));

    await publishEvent(channel, JSON.stringify({ type: "step_start", stepId: "s1" }));
    await publishEvent(channel, JSON.stringify({ type: "step_complete", stepId: "s1" }));

    expect(receivedA.length).toBe(2);
    expect(receivedB.length).toBe(2);
    expect(JSON.parse(receivedA[0]).type).toBe("step_start");
    expect(JSON.parse(receivedA[1]).type).toBe("step_complete");

    // Unsubscribing A (even twice) must leave B receiving events
    unsubA();
    unsubA();
    await publishEvent(channel, JSON.stringify({ type: "after_a_left" }));
    expect(receivedA.length).toBe(2);
    expect(receivedB.length).toBe(3);

    unsubB();
    await publishEvent(channel, JSON.stringify({ type: "ignored" }));
    expect(receivedB.length).toBe(3);
  });

  it("delivers once per subscriber and refcounts Redis unsubscribe when Redis is connected", async () => {
    const subEmitter = new EventEmitter();
    const subscribedChannels: string[] = [];
    const unsubscribedChannels: string[] = [];

    const mockClient = {
      publish: async (chan: string, msg: string) => {
        subEmitter.emit("message", chan, msg);
        return 1;
      },
    };
    const mockSub = Object.assign(subEmitter, {
      subscribe: async (chan: string) => {
        subscribedChannels.push(chan);
      },
      unsubscribe: async (chan: string) => {
        unsubscribedChannels.push(chan);
      },
    });

    _setRedisClientsForTest(mockClient, mockSub);

    const received1: string[] = [];
    const received2: string[] = [];
    const unsub1 = await subscribeEvent("run:1", (m) => received1.push(m));
    const unsub2 = await subscribeEvent("run:1", (m) => received2.push(m));

    // Only one Redis SUBSCRIBE despite two local handlers
    expect(subscribedChannels).toEqual(["run:1"]);
    // Shared dispatcher attaches only one "message" listener on sub
    expect(subEmitter.listenerCount("message")).toBe(1);

    await publishEvent("run:1", "hello");
    // Exactly one delivery per subscriber (no Redis + memoryEmitter double delivery)
    expect(received1).toEqual(["hello"]);
    expect(received2).toEqual(["hello"]);

    // Removing first subscriber must NOT unsubscribe the Redis channel
    unsub1();
    unsub1();
    expect(unsubscribedChannels).toEqual([]);

    await publishEvent("run:1", "second");
    expect(received1).toEqual(["hello"]);
    expect(received2).toEqual(["hello", "second"]);

    // Removing last subscriber unsubscribes from Redis
    unsub2();
    expect(unsubscribedChannels).toEqual(["run:1"]);
  });
});
