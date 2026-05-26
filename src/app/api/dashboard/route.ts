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

    const cacheKey = `dashboard:${user.userId}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayCount,
      todayCorrect,
      favoriteCount,
      studyDaysData,
      recentRecords,
      weeklyRecords,
    ] = await Promise.all([
      prisma.userQuestionRecord.count({
        where: {
          userId: user.userId,
          createdAt: { gte: todayStart },
        },
      }),
      prisma.userQuestionRecord.count({
        where: {
          userId: user.userId,
          createdAt: { gte: todayStart },
          isCorrect: true,
        },
      }),
      prisma.favorite.count({
        where: { userId: user.userId },
      }),
      prisma.$queryRaw<{ date: Date }[]>`
        SELECT DISTINCT DATE("createdAt") as date
        FROM "UserQuestionRecord"
        WHERE "userId" = ${user.userId} AND "createdAt" >= ${weekAgo}
      `,
      prisma.userQuestionRecord.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          question: {
            select: {
              id: true,
              content: true,
              type: true,
              answer: true,
              analysis: true,
              bank: {
                select: {
                  id: true,
                  title: true,
                  difficulty: true,
                },
              },
            },
          },
        },
      }),
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::int as count
        FROM "UserQuestionRecord"
        WHERE "userId" = ${user.userId} AND "createdAt" >= ${weekAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    const correctRate = todayCount > 0
      ? Math.round((todayCorrect / todayCount) * 100)
      : 0;

    const result = {
      stats: {
        todayCount,
        correctRate,
        favoriteCount,
        studyDays: studyDaysData.length,
      },
      weeklyRecords: weeklyRecords.map((r: any) => ({
        date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date).split("T")[0],
        count: Number(r.count),
      })),
      recentActivity: recentRecords.map((record) => ({
        id: record.id,
        questionId: record.questionId,
        userAnswer: record.userAnswer,
        isCorrect: record.isCorrect,
        duration: record.duration,
        question: {
          id: record.question.id,
          content: record.question.content,
          type: record.question.type,
          answer: record.question.answer,
          analysis: record.question.analysis,
          bank: record.question.bank
            ? {
                id: record.question.bank.id,
                title: record.question.bank.title,
                difficulty: record.question.bank.difficulty,
              }
            : null,
        },
        createdAt: record.createdAt.toISOString(),
      })),
    };

    await setToCache(cacheKey, result, 15);

    return Response.json(result);
  } catch (error: any) {
    console.error("获取仪表盘数据失败:", error);
    return Response.json({ error: "获取仪表盘数据失败" }, { status: 500 });
  }
}
