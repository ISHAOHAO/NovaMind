import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const isProd = process.env.NODE_ENV === "production";

export const redis = globalForRedis.redis || new Redis(REDIS_URL, {
  connectTimeout: 5000,
  commandTimeout: 5000,
  keepAlive: 30000,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 150, 1500);
  },
  maxRetriesPerRequest: isProd ? 2 : 3,
  enableOfflineQueue: true,
  enableReadyCheck: true,
  maxLoadingRetryTime: 3000,
  lazyConnect: false,
  reconnectOnError(err) {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

if (!isProd) {
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
    let cursor = "0";
    const pipeline = redis.pipeline();
    let keyCount = 0;
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        200
      );
      cursor = nextCursor;
      for (const key of keys) {
        pipeline.unlink(key);
        keyCount++;
      }
    } while (cursor !== "0");

    if (keyCount > 0) {
      await pipeline.exec();
    }
  } catch (err) {
    console.error("Cache invalidate error:", err);
  }
}

export default redis;
