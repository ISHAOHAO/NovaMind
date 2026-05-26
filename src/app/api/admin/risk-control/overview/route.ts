import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFromCache, setToCache } from "@/lib/redis";

export const GET = requireAdmin(async (_req: NextRequest) => {
  try {
    const cached = await getFromCache<any>("admin:risk-control:overview");
    if (cached) {
      return Response.json(cached);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalAttempts24h,
      failedAttempts24h,
      uniqueIps24h,
      blockedIps,
      todayAttempts,
      todayFailed,
      weeklyAttempts,
      weeklyFailed,
      topFailedIps,
      topFailedEmails,
      hourlyAttempts,
    ] = await Promise.all([
      prisma.loginAttempt.count({
        where: { createdAt: { gte: hours24Ago } },
      }),
      prisma.loginAttempt.count({
        where: { createdAt: { gte: hours24Ago }, success: false },
      }),
      prisma.loginAttempt.findMany({
        where: { createdAt: { gte: hours24Ago } },
        select: { ip: true },
        distinct: ["ip"],
      }),
      prisma.ipBlockRule.count(),
      prisma.loginAttempt.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.loginAttempt.count({
        where: { createdAt: { gte: todayStart }, success: false },
      }),
      prisma.loginAttempt.count({
        where: { createdAt: { gte: weekAgo } },
      }),
      prisma.loginAttempt.count({
        where: { createdAt: { gte: weekAgo }, success: false },
      }),
      prisma.loginAttempt.groupBy({
        by: ["ip"],
        where: { createdAt: { gte: hours24Ago }, success: false },
        _count: { ip: true },
        orderBy: { _count: { ip: "desc" } },
        take: 10,
      }),
      prisma.loginAttempt.groupBy({
        by: ["email"],
        where: { createdAt: { gte: hours24Ago }, success: false },
        _count: { email: true },
        orderBy: { _count: { email: "desc" } },
        take: 10,
      }),
      prisma.$queryRawUnsafe<Array<{ hour: string; count: number; failed: number }>>(
        `SELECT
          to_char("createdAt", 'YYYY-MM-DD HH24') as hour,
          COUNT(*)::int as count,
          SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::int as failed
        FROM "LoginAttempt"
        WHERE "createdAt" >= $1
        GROUP BY hour
        ORDER BY hour DESC
        LIMIT 48`,
        hours24Ago
      ),
    ]);

    const failedRate24h = totalAttempts24h > 0
      ? Math.round((failedAttempts24h / totalAttempts24h) * 100)
      : 0;

    const overview = {
      totalAttempts24h,
      failedAttempts24h,
      failedRate24h,
      uniqueIps24h: uniqueIps24h.length,
      blockedIps,
      todayAttempts,
      todayFailed,
      weeklyAttempts,
      weeklyFailed,
      topFailedIps: topFailedIps.map((r) => ({ ip: r.ip, count: r._count.ip })),
      topFailedEmails: topFailedEmails.map((r) => ({ email: r.email, count: r._count.email })),
      hourlyAttempts,
    };

    await setToCache("admin:risk-control:overview", overview, 30);

    return Response.json(overview);
  } catch (error) {
    console.error("获取风控概览失败:", error);
    return Response.json({ error: "获取数据失败" }, { status: 500 });
  }
});
