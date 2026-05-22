import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { formatDate, getDifficultyLabel } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const bankId = searchParams.get("bankId") || "";
    const isCorrectParam = searchParams.get("isCorrect");

    const where: any = { userId: user.userId };

    if (bankId) {
      where.question = { bankId };
    }

    if (isCorrectParam !== null && isCorrectParam !== "") {
      where.isCorrect = isCorrectParam === "true";
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
                  difficulty: true,
                },
              },
            },
          },
        },
      }),
      prisma.userQuestionRecord.count({ where }),
    ]);

    const result = records.map((record) => ({
      id: record.id,
      questionId: record.questionId,
      userAnswer: record.userAnswer,
      isCorrect: record.isCorrect,
      duration: record.duration,
      sessionId: record.sessionId,
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
              difficultyLabel: getDifficultyLabel(record.question.bank.difficulty),
            }
          : null,
      },
      createdAt: formatDate(record.createdAt),
    }));

    return Response.json({
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("获取答题历史失败:", error);
    return Response.json({ error: "获取答题历史失败，请稍后重试" }, { status: 500 });
  }
}
