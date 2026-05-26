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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    );
    const category = searchParams.get("category") || "";
    const bankId = searchParams.get("bankId") || "";

    const where: any = { userId: user.userId, isCorrect: false };
    if (category || bankId) {
      where.question = {};
      if (bankId) where.question.bankId = bankId;
      if (category) where.question.bank = { category };
    }

    const cacheKey = `analytics:error-bank:${user.userId}:${page}:${limit}:${category}:${bankId}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const [records, total] = await Promise.all([
      prisma.userQuestionRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
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
                  category: true,
                  difficulty: true,
                },
              },
            },
          },
        },
      }),
      prisma.userQuestionRecord.count({ where }),
    ]);

    const coverageCacheKey = `analytics:coverage:${user.userId}`;
    let coverage = await getFromCache<any[]>(coverageCacheKey);

    if (!coverage) {
      try {
        const coverageResult = await prisma.$queryRawUnsafe<
          { category: string; attempted: string; total: string }[]
        >(
          `SELECT 
            qb."category",
            COUNT(DISTINCT r."questionId")::int as attempted,
            (SELECT COUNT(*)::int FROM "Question" q2 WHERE q2."bankId" IN (SELECT qb2.id FROM "QuestionBank" qb2 WHERE qb2."category" = qb."category" AND qb2.status = 'APPROVED')) as total
          FROM "QuestionBank" qb
          LEFT JOIN "Question" q ON q."bankId" = qb.id
          LEFT JOIN "UserQuestionRecord" r ON r."questionId" = q.id AND r."userId" = $1
          WHERE qb.status = 'APPROVED'
          GROUP BY qb."category"`,
          user.userId
        );

        coverage = coverageResult.map((row) => ({
          category: row.category,
          attempted: parseInt(row.attempted),
          total: parseInt(row.total),
          rate:
            parseInt(row.total) > 0
              ? Math.round(
                  (parseInt(row.attempted) / parseInt(row.total)) * 100
                )
              : 0,
        }));

        await setToCache(coverageCacheKey, coverage, 300);
      } catch {
        coverage = [];
      }
    }

    const result = {
      errorQuestions: records.map((r) => ({
        id: r.id,
        questionId: r.questionId,
        userAnswer: r.userAnswer,
        duration: r.duration,
        createdAt: r.createdAt,
        question: {
          id: r.question.id,
          content: r.question.content,
          type: r.question.type,
          answer: r.question.answer,
          analysis: r.question.analysis,
          bank: r.question.bank,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      coverage,
    };

    await setToCache(cacheKey, result, 120);

    return Response.json(result);
  } catch (error: any) {
    console.error("获取错题列表失败:", error);
    return Response.json(
      { error: "获取错题列表失败，请稍后重试" },
      { status: 500 }
    );
  }
}
