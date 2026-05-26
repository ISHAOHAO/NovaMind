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

export async function checkAndIncrementAiUsage(userId: string): Promise<{
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

  const luaScript = `
    local current = redis.call('GET', KEYS[1])
    current = tonumber(current) or 0
    local limit = tonumber(ARGV[1])
    if current >= limit then
      return {0, current, limit}
    end
    local new = redis.call('INCR', KEYS[1])
    local expireAt = tonumber(ARGV[2])
    redis.call('EXPIREAT', KEYS[1], expireAt)
    return {1, new, limit}
  `;

  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const expireAt = Math.ceil(endOfDay.getTime() / 1000);

  const result = await redis.eval(
    luaScript,
    1,
    key,
    limit.toString(),
    expireAt.toString()
  ) as [number, number, number];

  const allowed = result[0] === 1;
  const used = result[1];
  const actualLimit = result[2];

  if (!allowed) {
    return {
      allowed: false,
      used,
      limit: actualLimit,
      message: `当日 AI 使用次数已达上限 (${used}/${actualLimit})，请激活完整版或明天再试`,
    };
  }

  return { allowed: true, used, limit: actualLimit };
}

// ============================================================
// Learning Analysis (weak-points) daily limit
// ============================================================
function getAnalysisKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `ai_analysis:${userId}:${today}`;
}

export async function checkAndIncrementAnalysisLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  message?: string;
}> {
  const limit = parseInt(
    await getSystemConfig("ai_analysis_daily_limit", "5"),
    10
  );

  const key = getAnalysisKey(userId);

  const luaScript = `
    local current = redis.call('GET', KEYS[1])
    current = tonumber(current) or 0
    local limit = tonumber(ARGV[1])
    if current >= limit then
      return {0, current, limit}
    end
    local new = redis.call('INCR', KEYS[1])
    local expireAt = tonumber(ARGV[2])
    redis.call('EXPIREAT', KEYS[1], expireAt)
    return {1, new, limit}
  `;

  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const expireAt = Math.ceil(endOfDay.getTime() / 1000);

  const result = await redis.eval(
    luaScript,
    1,
    key,
    limit.toString(),
    expireAt.toString()
  ) as [number, number, number];

  const allowed = result[0] === 1;
  const used = result[1];
  const actualLimit = result[2];

  if (!allowed) {
    return {
      allowed: false,
      used,
      limit: actualLimit,
      message: `当日学习分析次数已达上限 (${used}/${actualLimit})，请激活完整版或明天再试`,
    };
  }

  return { allowed: true, used, limit: actualLimit };
}

// ============================================================
// Note AI Summary daily limit
// ============================================================
function getNoteSummaryKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `ai_note_summary:${userId}:${today}`;
}

export async function checkAndIncrementNoteSummaryLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  message?: string;
}> {
  const limit = parseInt(
    await getSystemConfig("ai_note_summary_daily_limit", "5"),
    10
  );

  const key = getNoteSummaryKey(userId);

  const luaScript = `
    local current = redis.call('GET', KEYS[1])
    current = tonumber(current) or 0
    local limit = tonumber(ARGV[1])
    if current >= limit then
      return {0, current, limit}
    end
    local new = redis.call('INCR', KEYS[1])
    local expireAt = tonumber(ARGV[2])
    redis.call('EXPIREAT', KEYS[1], expireAt)
    return {1, new, limit}
  `;

  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const expireAt = Math.ceil(endOfDay.getTime() / 1000);

  const result = await redis.eval(
    luaScript,
    1,
    key,
    limit.toString(),
    expireAt.toString()
  ) as [number, number, number];

  const allowed = result[0] === 1;
  const used = result[1];
  const actualLimit = result[2];

  if (!allowed) {
    return {
      allowed: false,
      used,
      limit: actualLimit,
      message: `当日笔记AI总结次数已达上限 (${used}/${actualLimit})，请激活完整版或明天再试`,
    };
  }

  return { allowed: true, used, limit: actualLimit };
}
