import { redis } from "@/lib/redis";
import { getSystemConfig } from "@/lib/config";

function getUsageKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `ai_usage:${userId}:${today}`;
}

export async function checkAiUsageLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  message?: string;
}> {
  const limit = parseInt(
    await getSystemConfig("ai_trial_daily_limit", "20"),
    10
  );

  const key = getUsageKey(userId);
  const used = parseInt((await redis.get(key)) || "0", 10);

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      message: `当日 AI 使用次数已达上限 (${used}/${limit})，请激活完整版或明天再试`,
    };
  }

  return { allowed: true, used, limit };
}

export async function incrementAiUsage(userId: string): Promise<number> {
  const key = getUsageKey(userId);
  const newCount = await redis.incr(key);
  // Expire at end of day (Asia/Shanghai approximate)
  const now = new Date();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  const ttlSeconds = Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);
  await redis.expire(key, ttlSeconds);
  return newCount;
}

export async function getAiUsageToday(userId: string): Promise<{
  used: number;
  limit: number;
}> {
  const key = getUsageKey(userId);
  const used = parseInt((await redis.get(key)) || "0", 10);
  const limit = parseInt(
    await getSystemConfig("ai_trial_daily_limit", "20"),
    10
  );
  return { used, limit };
}
