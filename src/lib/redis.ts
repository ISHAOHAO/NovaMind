import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = globalForRedis.redis || new Redis(REDIS_URL, {
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  },
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  lazyConnect: false,
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

redis.on("connect", () => {
  console.log("Redis connected successfully");
});

export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setToCache(
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> {
  try {
    const data = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await redis.setex(key, ttlSeconds, data);
    } else {
      await redis.set(key, data);
    }
  } catch (err) {
    console.error("Cache set error:", err);
  }
}

export async function deleteFromCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("Cache delete error:", err);
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error("Cache invalidate error:", err);
  }
}

export default redis;
