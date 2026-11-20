import { EventEmitter } from "node:events";

let RedisClientClass: any = null;

// Dynamic import of ioredis to ensure safe fallback if module fails or in non-node runtimes
async function getRedisClass() {
  if (!RedisClientClass) {
    try {
      const mod = await import("ioredis");
      RedisClientClass = mod.default || mod.Redis || mod;
    } catch (e: any) {
      console.warn("[Cache] ioredis module could not be loaded:", e?.message);
    }
  }
  return RedisClientClass;
}

// In-Memory Fallback Structures
interface MemoryCacheEntry {
  value: string;
  expiresAt: number | null;
}

const memoryStore = new Map<string, MemoryCacheEntry>();
const memoryEmitter = new EventEmitter();
memoryEmitter.setMaxListeners(500);

// Global Redis singletons
let redisClient: any = null;
let redisSubClient: any = null;
let isRedisConnected = false;
let redisInitAttempted = false;

const memoryLocks = new Map<string, number>();

// Sweep expired in-memory fallback entries every 60s so long-running processes don't leak memory.
const MEMORY_SWEEP_INTERVAL_MS = 60_000;
const memorySweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of memoryStore) {
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      memoryStore.delete(k);
    }
  }
  for (const [k, expiresAt] of memoryLocks) {
    if (expiresAt <= now) {
      memoryLocks.delete(k);
    }
  }
}, MEMORY_SWEEP_INTERVAL_MS);
if (typeof (memorySweepTimer as any).unref === "function") {
  (memorySweepTimer as any).unref();
}

// Shared Redis pub/sub dispatcher with per-channel reference-counted handlers.
const redisChannelHandlers = new Map<string, Set<(message: string) => void>>();
let attachedSubClient: any = null;

function ensureRedisDispatcher(sub: any): void {
  if (!sub || attachedSubClient === sub) return;
  attachedSubClient = sub;
  sub.on("message", (chan: string, msg: string) => {
    const handlers = redisChannelHandlers.get(chan);
    if (!handlers || handlers.size === 0) return;
    for (const fn of Array.from(handlers)) {
      try {
        fn(msg);
      } catch (e: any) {
        console.warn(`[Cache] Redis subscriber handler error on "${chan}": ${e?.message || e}`);
      }
    }
  });
}

/**
 * Test helper to inject mock Redis clients or reset module state.
 */
export function _setRedisClientsForTest(client: any | null, sub: any | null): void {
  redisClient = client;
  redisSubClient = sub;
  isRedisConnected = Boolean(client);
  redisInitAttempted = Boolean(client);
  attachedSubClient = null;
  redisChannelHandlers.clear();
}

/**
 * Initializes the Redis connection if REDIS_URL or REDIS_HOST is configured.
 */
export async function getRedisConnection(): Promise<any | null> {
  if (redisClient) {
    return isRedisConnected ? redisClient : null;
  }

  const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);
  if (!redisUrl) {
    return null;
  }

  if (redisInitAttempted && !isRedisConnected) {
    return null;
  }

  redisInitAttempted = true;
  const RedisClass = await getRedisClass();
  if (!RedisClass) {
    return null;
  }

  try {
    const client = new RedisClass(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      retryStrategy(times: number) {
        if (times > 5) return null; // stop retrying after 5 attempts
        return Math.min(times * 200, 2000);
      },
    });

    client.on("connect", () => {
      isRedisConnected = true;
      console.log("[Cache] Connected to Redis cluster/instance successfully.");
    });

    client.on("error", (err: any) => {
      console.warn(`[Cache] Redis connection error: ${err.message}`);
      isRedisConnected = false;
    });

    client.on("close", () => {
      isRedisConnected = false;
    });

    await client.connect();
    redisClient = client;
    isRedisConnected = true;
    return redisClient;
  } catch (err: any) {
    console.warn(`[Cache] Failed to connect to Redis (${err.message}). Using in-memory fallback.`);
    isRedisConnected = false;
    return null;
  }
}

async function getRedisSubConnection(): Promise<any | null> {
  const mainClient = await getRedisConnection();
  if (!mainClient) return null;
  if (redisSubClient) return redisSubClient;

  try {
    const sub = mainClient.duplicate();
    sub.on?.("close", () => {
      if (redisSubClient === sub) redisSubClient = null;
      if (attachedSubClient === sub) attachedSubClient = null;
    });
    sub.on?.("error", (err: any) => {
      console.warn(`[Cache] Redis subscriber error: ${err?.message || err}`);
    });
    await sub.connect();
    redisSubClient = sub;
    return redisSubClient;
  } catch (err: any) {
    console.warn(`[Cache] Failed to create Redis subscriber client: ${err.message}`);
    return null;
  }
}

/** Check if Redis is actively connected */
export function isRedisAvailable(): boolean {
  return isRedisConnected && redisClient !== null;
}

/**
 * Get cached string by key (or null if expired / miss).
 */
export async function getCache(key: string): Promise<string | null> {
  const client = await getRedisConnection();
  if (client) {
    try {
      return await client.get(key);
    } catch (e: any) {
      console.warn(`[Cache] Redis get error on "${key}": ${e.message}`);
    }
  }

  // Fallback: in-memory
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Set string key with optional TTL in seconds.
 */
export async function setCache(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const client = await getRedisConnection();
  if (client) {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, value, "EX", ttlSeconds);
      } else {
        await client.set(key, value);
      }
      return;
    } catch (e: any) {
      console.warn(`[Cache] Redis set error on "${key}": ${e.message}`);
    }
  }

  // Fallback: in-memory
  const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  memoryStore.set(key, { value, expiresAt });
}

/**
 * Delete cached key.
 */
export async function delCache(key: string): Promise<void> {
  const client = await getRedisConnection();
  if (client) {
    try {
      await client.del(key);
      return;
    } catch (e: any) {
      console.warn(`[Cache] Redis del error on "${key}": ${e.message}`);
    }
  }

  memoryStore.delete(key);
}

/**
 * Acquire a distributed atomic lock with TTL.
 * Returns true if lock was acquired, false if already locked by another process/replica.
 */
export async function acquireLock(lockKey: string, ttlSeconds = 60): Promise<boolean> {
  const client = await getRedisConnection();
  if (client) {
    try {
      const res = await client.set(lockKey, "1", "NX", "EX", ttlSeconds);
      return res === "OK";
    } catch (e: any) {
      console.warn(`[Cache] Redis lock error on "${lockKey}": ${e.message}`);
    }
  }

  // Fallback: in-memory atomic lock
  const now = Date.now();
  const existingExpires = memoryLocks.get(lockKey);
  if (existingExpires && existingExpires > now) {
    return false;
  }
  memoryLocks.set(lockKey, now + ttlSeconds * 1000);
  return true;
}

/**
 * Release an acquired lock.
 */
export async function releaseLock(lockKey: string): Promise<void> {
  const client = await getRedisConnection();
  if (client) {
    try {
      await client.del(lockKey);
      return;
    } catch (e: any) {
      console.warn(`[Cache] Redis releaseLock error: ${e.message}`);
    }
  }

  memoryLocks.delete(lockKey);
}

/**
 * Publish an event message to a channel (Pub/Sub).
 */
export async function publishEvent(channel: string, message: string): Promise<void> {
  const client = await getRedisConnection();
  if (client) {
    try {
      await client.publish(channel, message);
      return;
    } catch (e: any) {
      console.warn(`[Cache] Redis publish error on "${channel}": ${e.message}`);
    }
  }

  // Fallback: emit to local process emitter only when Redis is unavailable
  memoryEmitter.emit(channel, message);
}

/**
 * Subscribe to a channel (Pub/Sub).
 * Returns an unsubscribe cleanup function.
 */
export async function subscribeEvent(channel: string, handler: (message: string) => void): Promise<() => void> {
  const sub = await getRedisSubConnection();
  if (sub) {
    try {
      ensureRedisDispatcher(sub);
      let set = redisChannelHandlers.get(channel);
      const needsSubscribe = !set || set.size === 0;
      if (!set) {
        set = new Set();
        redisChannelHandlers.set(channel, set);
      }
      set.add(handler);
      if (needsSubscribe) {
        try {
          await sub.subscribe(channel);
        } catch (subErr) {
          set.delete(handler);
          if (set.size === 0) redisChannelHandlers.delete(channel);
          throw subErr;
        }
      }

      let cleaned = false;
      return () => {
        if (cleaned) return;
        cleaned = true;
        const currentSet = redisChannelHandlers.get(channel);
        if (!currentSet) return;
        currentSet.delete(handler);
        if (currentSet.size === 0) {
          redisChannelHandlers.delete(channel);
          try {
            sub.unsubscribe(channel).catch(() => {});
          } catch {}
        }
      };
    } catch (e: any) {
      console.warn(`[Cache] Redis subscribe error on "${channel}": ${e.message}`);
    }
  }

  // Fallback: in-memory emitter
  memoryEmitter.on(channel, handler);
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    memoryEmitter.off(channel, handler);
  };
}
