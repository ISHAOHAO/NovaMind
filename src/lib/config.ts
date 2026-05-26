import { prisma } from "./prisma";
import { getFromCache, setToCache, invalidatePattern } from "./redis";

export async function getSystemConfig(key: string, defaultValue = ""): Promise<string> {
  try {
    const cacheKey = `config:${key}`;
    const cached = await getFromCache<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const config = await prisma.systemConfig.findUnique({ where: { key } });
    const value = config?.value ?? defaultValue;
    await setToCache(cacheKey, value, 300);
    return value;
  } catch {
    return defaultValue;
  }
}

export async function getSystemConfigs(keys: string[]): Promise<Record<string, string>> {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: keys } },
    });
    const result: Record<string, string> = {};
    for (const config of configs) {
      result[config.key] = config.value;
    }
    return result;
  } catch {
    return {};
  }
}

export async function setSystemConfig(key: string, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value, description: "" },
  });
  await invalidatePattern("config:*");
}

const configCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL = 30000;

export async function getCachedConfig(key: string, defaultValue = ""): Promise<string> {
  const cached = configCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await getSystemConfig(key, defaultValue);
  configCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
  return value;
}
