import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { generateQuestionsByTopic } from "@/lib/ai";
import { getSystemConfig } from "@/lib/config";
import { checkAiUsageLimit, incrementAiUsage } from "@/lib/ai-usage";
import { formatDate } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isActivated: true, banned: true, deletedAt: true },
      });

      if (!dbUser || dbUser.deletedAt || dbUser.banned) {
        return Response.json({ error: "账号状态异常" }, { status: 403 });
      }

      if (!dbUser.isActivated) {
        const usageCheck = await checkAiUsageLimit(user.userId);
        if (!usageCheck.allowed) {
          return Response.json(
            { error: usageCheck.message, usage: { used: usageCheck.used, limit: usageCheck.limit } },
            { status: 429 }
          );
        }
      }
    }

    const aiEnabled = await getSystemConfig("ai_enabled");
    if (aiEnabled !== "true") {
      return Response.json({ error: "AI 功能未启用，请联系管理员" }, { status: 403 });
    }

    const body = await req.json();
    const { topic, questionCount, difficulty, durationMinutes, examTitle } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return Response.json({ error: "请提供考试主题" }, { status: 400 });
    }

    const qCount = parseInt(String(questionCount), 10);
    if (!qCount || qCount < 1 || qCount > 50) {
      return Response.json({ error: "题目数量应在 1 到 50 之间" }, { status: 400 });
    }

    const diff = parseInt(String(difficulty || "3"), 10);
    if (diff < 1 || diff > 5) {
      return Response.json({ error: "难度等级应在 1 到 5 之间" }, { status: 400 });
    }

    const dur = parseInt(String(durationMinutes || "60"), 10);
    if (dur < 1 || dur > 480) {
      return Response.json({ error: "考试时长应在 1 到 480 分钟之间" }, { status: 400 });
    }

    const result = await generateQuestionsByTopic(topic.trim(), qCount, diff, "single");

    if (!result.success) {
      return Response.json(
        { error: result.error || "AI 生成题目失败，请稍后重试" },
        { status: 500 }
      );
    }

    let questions: any[];
    try {
      const cleaned = result.content
        .replace(/```json\s*/gi, "")
        .replace(/```/g, "")
        .trim();
      questions = JSON.parse(cleaned);
      if (!Array.isArray(questions)) {
        throw new Error("AI 返回格式不是数组");
      }
    } catch {
      return Response.json(
        { error: "AI 生成结果解析失败，请重试" },
        { status: 500 }
      );
    }

    const title = examTitle?.trim() || `${topic.trim()} - 模拟考试`;

    const bank = await prisma.questionBank.create({
      data: {
        title: `${title} (AI 生成)`,
        description: `AI 根据主题"${topic.trim()}"自动生成的题库`,
        source: "AI 生成",
        category: topic.trim(),
        tags: ["AI生成"],
        difficulty: diff,
        isPublic: false,
        uploaderId: user.userId,
        status: "APPROVED",
      },
    });

    const createdQuestions = await Promise.all(
      questions.map((q, idx) =>
        prisma.question.create({
          data: {
            bankId: bank.id,
            type: "single",
            content: q.content || "",
            options: q.options || [],
            answer: q.answer || "",
            analysis: q.analysis || "",
            sortOrder: idx,
          },
        })
      )
    );

    const exam = await prisma.exam.create({
      data: {
        title,
        description: `AI 生成 - ${topic.trim()}`,
        userId: user.userId,
        durationMinutes: dur,
        difficulty: diff,
        totalQuestions: createdQuestions.length,
        status: "DRAFT",
        settings: { aiGenerated: true, topic: topic.trim() },
        questions: {
          create: createdQuestions.map((q, idx) => ({
            questionId: q.id,
            sortOrder: idx,
          })),
        },
      },
      include: {
        _count: { select: { questions: true } },
      },
    });

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isActivated: true },
      });
      if (dbUser && !dbUser.isActivated) {
        const newCount = await incrementAiUsage(user.userId);
        const limitVal = parseInt(await getSystemConfig("ai_trial_daily_limit", "20"), 10);
        return Response.json(
          {
            exam: {
              id: exam.id,
              title: exam.title,
              status: exam.status,
              questionCount: exam._count.questions,
              createdAt: formatDate(exam.createdAt),
            },
            usage: { used: newCount, limit: limitVal },
          },
          { status: 201 }
        );
      }
    }

    return Response.json(
      {
        exam: {
          id: exam.id,
          title: exam.title,
          status: exam.status,
          questionCount: exam._count.questions,
          createdAt: formatDate(exam.createdAt),
        },
        message: "AI 考试生成成功",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("AI 生成考试失败:", error);
    return Response.json({ error: "AI 生成考试失败，请稍后重试" }, { status: 500 });
  }
}
