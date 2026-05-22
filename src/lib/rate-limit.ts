import { redis } from "./redis";
import { prisma } from "./prisma";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 60,
  keyPrefix: "rate_limit",
};

export async function rateLimit(
  key: string,
  config: Partial<RateLimitConfig> = {}
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const cfg = { ...defaultConfig, ...config };
  const redisKey = `${cfg.keyPrefix}:${key}`;
  const now = Date.now();
  const windowStart = now - cfg.windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart);
  pipeline.zcard(redisKey);
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
  pipeline.expire(redisKey, Math.ceil(cfg.windowMs / 1000) + 1);

  const [, count] = await pipeline.exec() as [
    [null, number] | null,
    [null, number] | null,
    [null, number] | null,
    [null, number] | null,
  ];

  const requestCount = count?.[1] ?? 0;

  return {
    allowed: requestCount < cfg.maxRequests,
    remaining: Math.max(0, cfg.maxRequests - requestCount - 1),
    resetAt: now + cfg.windowMs,
  };
}

export async function checkBlacklist(identifier: string): Promise<boolean> {
  const key = `blacklist:${identifier}`;
  const result = await redis.get(key);
  return result === "1";
}

export async function addToBlacklist(
  identifier: string,
  ttlSeconds = 3600
): Promise<void> {
  await redis.setex(`blacklist:${identifier}`, ttlSeconds, "1");
}

export async function removeFromBlacklist(identifier: string): Promise<void> {
  await redis.del(`blacklist:${identifier}`);
}

export async function checkRegistrationLimit(
  identifier: string,
  type: "ip" | "device" | "email_domain"
): Promise<boolean> {
  const limitKey = `reg_limit:${type}:${identifier}`;
  const limitConfig = await prisma.systemConfig.findFirst({
    where: {
      key: `register_${type === "email_domain" ? "email" : type}_limit`,
    },
  });

  const maxRegistrations = parseInt(limitConfig?.value || "5", 10);
  const current = await redis.get(limitKey);
  const count = parseInt(current || "0", 10);

  if (count >= maxRegistrations) return false;

  await redis.incr(limitKey);
  await redis.expire(limitKey, 86400);
  return true;
}
