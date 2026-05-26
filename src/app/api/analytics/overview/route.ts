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

    const cacheKey = `analytics:overview:${user.userId}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalQuestions,
      correctCount,
      todayQuestions,
      distinctBankResult,
      activeDaysResult,
      avgDurationResult,
    ] = await Promise.all([
      prisma.userQuestionRecord.count({ where: { userId: user.userId } }),
      prisma.userQuestionRecord.count({
        where: { userId: user.userId, isCorrect: true },
      }),
      prisma.userQuestionRecord.count({
        where: { userId: user.userId, createdAt: { gte: today } },
      }),
      prisma.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(DISTINCT q."bankId")::int as count FROM "UserQuestionRecord" r JOIN "Question" q ON r."questionId" = q.id WHERE r."userId" = $1`,
        user.userId
      ),
      prisma.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(DISTINCT "createdAt"::date)::int as count FROM "UserQuestionRecord" WHERE "userId" = $1`,
        user.userId
      ),
      prisma.userQuestionRecord.aggregate({
        where: { userId: user.userId },
        _avg: { duration: true },
      }),
    ]);

    const correctRate =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    const totalBanks = parseInt(distinctBankResult[0]?.count || "0");
    const activeDays = parseInt(activeDaysResult[0]?.count || "0");

    const data = {
      totalQuestions,
      correctCount,
      wrongCount: totalQuestions - correctCount,
      correctRate,
      todayQuestions,
      totalBanks,
      activeDays,
      avgDuration: Math.round(avgDurationResult._avg.duration || 0),
    };

    await setToCache(cacheKey, data, 300);

    return Response.json(data);
  } catch (error: any) {
    console.error("获取学习概览失败:", error);
    return Response.json(
      { error: "获取学习概览失败，请稍后重试" },
      { status: 500 }
    );
  }
}
