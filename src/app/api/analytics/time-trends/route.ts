import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { getFromCache, setToCache } from "@/lib/redis";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "week";

    if (!["day", "week", "month"].includes(period)) {
      return Response.json(
        { error: "period 参数无效，可选: day, week, month" },
        { status: 400 }
      );
    }

    const cacheKey = `analytics:time-trends:${user.userId}:${period}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "day":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    let trends: {
      label: string;
      total: number;
      correct: number;
      wrong: number;
      correctRate: number;
    }[] = [];

    if (period === "day") {
      const result = await prisma.$queryRawUnsafe<
        { hour: string; total: string; correct: string }[]
      >(
        `SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, COUNT(*)::int as total, SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END)::int as correct FROM "UserQuestionRecord" WHERE "userId" = $1 AND "createdAt" >= $2 GROUP BY EXTRACT(HOUR FROM "createdAt") ORDER BY hour`,
        user.userId,
        startDate
      );

      for (let h = 0; h < 24; h++) {
        const existing = result.find((r) => parseInt(r.hour) === h);
        const total = existing ? parseInt(existing.total) : 0;
        const correct = existing ? parseInt(existing.correct) : 0;
        trends.push({
          label: `${String(h).padStart(2, "0")}:00`,
          total,
          correct,
          wrong: total - correct,
          correctRate: total > 0 ? Math.round((correct / total) * 100) : 0,
        });
      }
    } else {
      const result = await prisma.$queryRawUnsafe<
        { date: string; total: string; correct: string }[]
      >(
        `SELECT "createdAt"::date as date, COUNT(*)::int as total, SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END)::int as correct FROM "UserQuestionRecord" WHERE "userId" = $1 AND "createdAt" >= $2 GROUP BY "createdAt"::date ORDER BY date`,
        user.userId,
        startDate
      );

      const count = period === "week" ? 7 : 30;
      const existingMap = new Map<string, { total: number; correct: number }>();
      for (const row of result) {
        const dateStr = String(row.date).slice(0, 10);
        existingMap.set(dateStr, {
          total: parseInt(row.total),
          correct: parseInt(row.correct),
        });
      }

      for (let i = count - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().slice(0, 10);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        const existing = existingMap.get(dateStr);
        const total = existing ? existing.total : 0;
        const correct = existing ? existing.correct : 0;
        trends.push({
          label,
          total,
          correct,
          wrong: total - correct,
          correctRate: total > 0 ? Math.round((correct / total) * 100) : 0,
        });
      }
    }

    const data = { trends, period };

    await setToCache(cacheKey, data, 300);

    return Response.json(data);
  } catch (error: any) {
    console.error("获取时间趋势失败:", error);
    return Response.json(
      { error: "获取时间趋势失败，请稍后重试" },
      { status: 500 }
    );
  }
}
