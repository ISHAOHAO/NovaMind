import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { analyzeQuestion, explainAnswer, generateSimilarQuestion } from "@/lib/ai";
import { askAiSchema } from "@/lib/validations";
import { getSystemConfig } from "@/lib/config";
import { checkAndIncrementAiUsage, refundAiUsage } from "@/lib/ai-usage";

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录，请先登录后使用" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = askAiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "参数错误", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { questionId, action } = parsed.data;

    const aiEnabled = await getSystemConfig("ai_enabled");
    if (aiEnabled !== "true") {
      return NextResponse.json({ error: "AI 功能未启用，请联系管理员" }, { status: 403 });
    }

    // Check activation for non-admin users
    let isTrialUser = false;
    let usage: { used: number; limit: number } | null = null;
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isActivated: true, banned: true, deletedAt: true },
      });

      if (!dbUser || dbUser.banned) {
        return NextResponse.json({ error: "账号已被封禁" }, { status: 403 });
      }

      if (!dbUser.isActivated) {
        isTrialUser = true;
        // 原子化“检查+扣减”，防止并发请求绕过每日限额
        const usageCheck = await checkAndIncrementAiUsage(user.userId);
        if (!usageCheck.allowed) {
          return NextResponse.json(
            { error: usageCheck.message, usage: { used: usageCheck.used, limit: usageCheck.limit } },
            { status: 429 }
          );
        }
        usage = { used: usageCheck.used, limit: usageCheck.limit };
      }
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, content: true, answer: true, analysis: true },
    });

    if (!question) {
      return NextResponse.json({ error: "题目不存在" }, { status: 404 });
    }

    let result;
    switch (action) {
      case "analyze":
        result = await analyzeQuestion(
          question.content,
          question.answer,
          question.analysis ?? undefined
        );
        break;
      case "explain":
        result = await explainAnswer(question.content, question.answer);
        break;
      case "similar":
        result = await generateSimilarQuestion(question.content, question.answer);
        break;
    }

    if (!result.success) {
      // AI 调用失败，退还本次额度
      if (isTrialUser) {
        await refundAiUsage(user.userId);
      }
      return NextResponse.json(
        { error: result.error || "AI 请求失败，请稍后重试" },
        { status: 500 }
      );
    }

    if (isTrialUser && usage) {
      return NextResponse.json({
        success: true,
        content: result.content,
        usage,
      });
    }

    return NextResponse.json({ success: true, content: result.content });
  } catch (error) {
    console.error("[AI Ask] Error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
