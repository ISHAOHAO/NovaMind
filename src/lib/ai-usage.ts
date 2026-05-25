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

// ============================================================
// Upload Analysis (monthly limit)
// ============================================================
function getUploadAnalyzeKey(userId: string): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `ai_upload_analyze:${userId}:${now.getFullYear()}-${month}`;
}

export async function checkUploadAnalyzeLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  message?: string;
}> {
  const limit = parseInt(
    await getSystemConfig("ai_upload_analyze_monthly_limit", "10"),
    10
  );

  const key = getUploadAnalyzeKey(userId);
  const used = parseInt((await redis.get(key)) || "0", 10);

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      message: `本月上传分析次数已达上限 (${used}/${limit})，请下月再试`,
    };
  }

  return { allowed: true, used, limit };
}

export async function incrementUploadAnalyzeUsage(userId: string): Promise<number> {
  const key = getUploadAnalyzeKey(userId);
  const newCount = await redis.incr(key);
  // Expire at end of month
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const ttlSeconds = Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000);
  await redis.expire(key, ttlSeconds);
  return newCount;
}

export async function getUploadAnalyzeRemaining(userId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const key = getUploadAnalyzeKey(userId);
  const used = parseInt((await redis.get(key)) || "0", 10);
  const limit = parseInt(
    await getSystemConfig("ai_upload_analyze_monthly_limit", "10"),
    10
  );
  return { used, limit, remaining: Math.max(0, limit - used) };
}
