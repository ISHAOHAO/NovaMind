import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { gradeAnswer, normalizeUserAnswer } from "@/lib/grading";
import { formatDate, getDifficultyLabel } from "@/lib/utils";
import { getFromCache, setToCache, deleteFromCache } from "@/lib/redis";

function getExamCacheKey(examId: string) {
  return `exam:detail:${examId}`;
}

type RouteContext = { params: Promise<{ examId: string }> };

export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { examId } = await context.params;

    const cacheKey = getExamCacheKey(examId);
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      if (cached.userId !== user.userId) {
        return Response.json({ error: "无权访问该考试" }, { status: 403 });
      }
      return Response.json(cached);
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { sortOrder: "asc" },
          include: {
            question: true,
          },
        },
      },
    });

    if (!exam) {
      return Response.json({ error: "考试不存在" }, { status: 404 });
    }

    if (exam.userId !== user.userId) {
      return Response.json({ error: "无权访问该考试" }, { status: 403 });
    }

    const result = {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      difficulty: exam.difficulty,
      difficultyLabel: getDifficultyLabel(exam.difficulty),
      totalQuestions: exam.totalQuestions,
      correctCount: exam.correctCount,
      score: exam.score,
      status: exam.status,
      startedAt: exam.startedAt ? formatDate(exam.startedAt) : null,
      completedAt: exam.completedAt ? formatDate(exam.completedAt) : null,
      settings: exam.settings,
      userId: exam.userId,
      createdAt: formatDate(exam.createdAt),
      updatedAt: formatDate(exam.updatedAt),
      questions: exam.questions.map((eq) => ({
        id: eq.id,
        questionId: eq.question.id,
        sortOrder: eq.sortOrder,
        userAnswer: eq.userAnswer,
        isCorrect: eq.isCorrect,
        question: {
          id: eq.question.id,
          type: eq.question.type,
          content: eq.question.content,
          options: eq.question.options,
          // 答案/解析仅在考试完成（已判分）后回传；草稿与进行中一律剥离，防止开考前背题
          answer: exam.status === "COMPLETED" ? eq.question.answer : undefined,
          analysis: exam.status === "COMPLETED" ? eq.question.analysis : undefined,
          image: eq.question.image,
        },
      })),
    };

    await setToCache(cacheKey, result, 120);

    return Response.json(result);
  } catch (error: any) {
    console.error("获取考试详情失败:", error);
    return Response.json({ error: "获取考试详情失败，请稍后重试" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { examId } = await context.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          include: { question: true },
        },
      },
    });

    if (!exam) {
      return Response.json({ error: "考试不存在" }, { status: 404 });
    }

    if (exam.userId !== user.userId) {
      return Response.json({ error: "无权操作该考试" }, { status: 403 });
    }

    const body = await req.json();
    // 注意：不读取客户端提交的 isCorrect，判分一律以服务端结果为准
    const { action, questionId } = body;

    const cacheKey = getExamCacheKey(examId);
    await deleteFromCache(cacheKey);

    if (action === "start") {
      if (exam.status !== "DRAFT") {
        return Response.json({ error: "只有草稿状态的考试才能开始" }, { status: 400 });
      }

      const updated = await prisma.exam.update({
        where: { id: examId },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });

      return Response.json({
        id: updated.id,
        status: updated.status,
        startedAt: formatDate(updated.startedAt!),
        message: "考试已开始",
      });
    }

    if (action === "answer") {
      if (exam.status !== "IN_PROGRESS") {
        return Response.json({ error: "考试未在进行中" }, { status: 400 });
      }

      if (!questionId) {
        return Response.json({ error: "请提供题目ID" }, { status: 400 });
      }

      const userAnswer = normalizeUserAnswer(body.userAnswer);
      if (body.userAnswer !== undefined && body.userAnswer !== null && userAnswer === null) {
        return Response.json({ error: "作答内容格式不正确" }, { status: 400 });
      }

      const examQuestion = await prisma.examQuestion.findUnique({
        where: {
          examId_questionId: {
            examId,
            questionId,
          },
        },
        include: {
          question: { select: { id: true, type: true, answer: true } },
        },
      });

      if (!examQuestion) {
        return Response.json({ error: "题目不属于该考试" }, { status: 404 });
      }

      // 服务端依据标准答案判分，不信任客户端结果
      const isCorrect = gradeAnswer(
        examQuestion.question.type,
        examQuestion.question.answer,
        userAnswer
      );

      await prisma.examQuestion.update({
        where: { id: examQuestion.id },
        data: {
          userAnswer: userAnswer ?? null,
          isCorrect,
        },
      });

      return Response.json({ message: "答案已保存", isCorrect });
    }

    if (action === "complete") {
      if (exam.status !== "IN_PROGRESS" && exam.status !== "DRAFT") {
        return Response.json({ error: "考试状态不允许交卷" }, { status: 400 });
      }

      const startStatus = exam.startedAt ? "IN_PROGRESS" : "IN_PROGRESS";
      const startedAt = exam.startedAt || new Date();

      if (exam.status === "DRAFT") {
        await prisma.exam.update({
          where: { id: examId },
          data: { status: startStatus, startedAt },
        });
      }

      const examQuestions = await prisma.examQuestion.findMany({
        where: { examId },
      });

      const correctCount = examQuestions.filter((eq) => eq.isCorrect === true).length;
      const totalQuestions = examQuestions.length;
      const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

      const updated = await prisma.exam.update({
        where: { id: examId },
        data: {
          status: "COMPLETED",
          correctCount,
          score,
          completedAt: new Date(),
        },
        include: {
          questions: {
            orderBy: { sortOrder: "asc" },
            include: { question: true },
          },
        },
      });

      const result = {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        totalQuestions: updated.totalQuestions,
        correctCount: updated.correctCount,
        score: updated.score,
        completedAt: formatDate(updated.completedAt!),
        questions: updated.questions.map((eq) => ({
          id: eq.id,
          questionId: eq.question.id,
          sortOrder: eq.sortOrder,
          userAnswer: eq.userAnswer,
          isCorrect: eq.isCorrect,
          question: {
            id: eq.question.id,
            type: eq.question.type,
            content: eq.question.content,
            options: eq.question.options,
            answer: eq.question.answer,
            analysis: eq.question.analysis,
            image: eq.question.image,
          },
        })),
        message: "考试完成",
      };

      return Response.json(result);
    }

    if (action === "abandon") {
      // 仅允许本人将进行中的考试置为已放弃（本人校验已在上方完成）
      if (exam.status !== "IN_PROGRESS") {
        return Response.json({ error: "只有进行中的考试才能放弃" }, { status: 400 });
      }

      const updated = await prisma.exam.update({
        where: { id: examId },
        data: { status: "ABANDONED" },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.userId,
          action: "EXAM_ABANDON",
          details: JSON.stringify({ examId, title: exam.title }),
          ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
          userAgent: req.headers.get("user-agent") || null,
        },
      });

      return Response.json({
        id: updated.id,
        status: updated.status,
        message: "考试已放弃",
      });
    }

    return Response.json({ error: "无效的操作" }, { status: 400 });
  } catch (error: any) {
    console.error("操作考试失败:", error);
    return Response.json({ error: "操作考试失败，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { examId } = await context.params;

    const exam = await prisma.exam.findUnique({ where: { id: examId } });

    if (!exam) {
      return Response.json({ error: "考试不存在" }, { status: 404 });
    }

    if (exam.userId !== user.userId) {
      return Response.json({ error: "无权操作该考试" }, { status: 403 });
    }

    if (exam.status === "IN_PROGRESS") {
      return Response.json({ error: "进行中的考试不能删除" }, { status: 400 });
    }

    await prisma.exam.delete({ where: { id: examId } });

    const cacheKey = getExamCacheKey(examId);
    await deleteFromCache(cacheKey);

    return Response.json({ message: "考试已删除" });
  } catch (error: any) {
    console.error("删除考试失败:", error);
    return Response.json({ error: "删除考试失败，请稍后重试" }, { status: 500 });
  }
}
