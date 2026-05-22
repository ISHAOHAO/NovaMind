import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const { questionId, userAnswer, isCorrect, duration, sessionId } = body;

    if (!questionId) {
      return Response.json({ error: "缺少 questionId" }, { status: 400 });
    }

    if (userAnswer === undefined || userAnswer === null) {
      return Response.json({ error: "缺少 userAnswer" }, { status: 400 });
    }

    if (isCorrect === undefined || isCorrect === null) {
      return Response.json({ error: "缺少 isCorrect" }, { status: 400 });
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      return Response.json({ error: "题目不存在" }, { status: 404 });
    }

    const record = await prisma.userQuestionRecord.create({
      data: {
        userId: user.userId,
        questionId,
        userAnswer: String(userAnswer),
        isCorrect: Boolean(isCorrect),
        duration: typeof duration === "number" ? Math.max(0, duration) : 0,
        sessionId: sessionId || null,
      },
    });

    return Response.json({
      data: {
        id: record.id,
        questionId: record.questionId,
        userAnswer: record.userAnswer,
        isCorrect: record.isCorrect,
        duration: record.duration,
        createdAt: formatDate(record.createdAt),
      },
      message: "答题记录已保存",
    }, { status: 201 });
  } catch (error: any) {
    console.error("保存答题记录失败:", error);
    return Response.json({ error: "保存答题记录失败，请稍后重试" }, { status: 500 });
  }
}
