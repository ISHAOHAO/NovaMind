import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { normalizeUserAnswer } from "@/lib/grading";
import { formatDate } from "@/lib/utils";
import { deleteFromCache } from "@/lib/redis";

const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const { questionId, isCorrect, duration, sessionId } = body;

    if (!questionId || typeof questionId !== "string") {
      return Response.json({ error: "缺少 questionId" }, { status: 400 });
    }

    // 作答内容必须是长度受限的字符串
    const userAnswer = normalizeUserAnswer(body.userAnswer);
    if (userAnswer === null) {
      return Response.json({ error: "userAnswer 格式不正确" }, { status: 400 });
    }

    if (typeof isCorrect !== "boolean") {
      return Response.json({ error: "isCorrect 必须为布尔值" }, { status: 400 });
    }

    if (sessionId !== undefined && sessionId !== null && typeof sessionId !== "string") {
      return Response.json({ error: "sessionId 格式不正确" }, { status: 400 });
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      return Response.json({ error: "题目不存在" }, { status: 404 });
    }

    const record = await prisma.userQuestionRecord.create({
      data: {
        userId: user.userId,
        questionId,
        userAnswer,
        isCorrect,
        duration:
          typeof duration === "number" && Number.isFinite(duration)
            ? Math.min(Math.max(0, duration), MAX_DURATION_MS)
            : 0,
        sessionId: sessionId || null,
      },
    });

    deleteFromCache(`dashboard:${user.userId}`).catch(() => {});

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
