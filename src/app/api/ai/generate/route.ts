import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { generateQuestionsByTopic } from "@/lib/ai";
import { getSystemConfig } from "@/lib/config";
import { checkAiUsageLimit, incrementAiUsage } from "@/lib/ai-usage";

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录，请先登录后使用" }, { status: 401 });
    }

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isActivated: true, banned: true, deletedAt: true },
      });

      if (!dbUser || dbUser.deletedAt || dbUser.banned) {
        return NextResponse.json({ error: "账号状态异常" }, { status: 403 });
      }

      if (!dbUser.isActivated) {
        const usageCheck = await checkAiUsageLimit(user.userId);
        if (!usageCheck.allowed) {
          return NextResponse.json(
            { error: usageCheck.message, usage: { used: usageCheck.used, limit: usageCheck.limit } },
            { status: 429 }
          );
        }
      }
    }

    const aiEnabled = await getSystemConfig("ai_enabled");
    if (aiEnabled !== "true") {
      return NextResponse.json({ error: "AI 功能未启用，请联系管理员" }, { status: 403 });
    }

    const body = await request.json();
    const { topic, count = 5, difficulty = 3, type = "single" } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json({ error: "请提供题目主题" }, { status: 400 });
    }

    if (typeof count !== "number" || count < 1 || count > 50) {
      return NextResponse.json({ error: "题目数量应在 1 到 50 之间" }, { status: 400 });
    }

    if (typeof difficulty !== "number" || difficulty < 1 || difficulty > 5) {
      return NextResponse.json({ error: "难度等级应在 1 到 5 之间" }, { status: 400 });
    }

    if (!["single", "multiple"].includes(type)) {
      return NextResponse.json({ error: "题目类型无效" }, { status: 400 });
    }

    const result = await generateQuestionsByTopic(topic.trim(), count, difficulty, type);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "AI 生成题目失败，请稍后重试" },
        { status: 500 }
      );
    }

    // Track usage for non-activated users
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isActivated: true },
      });
      if (dbUser && !dbUser.isActivated) {
        const newCount = await incrementAiUsage(user.userId);
        const limit = parseInt(await getSystemConfig("ai_trial_daily_limit", "20"), 10);
        return NextResponse.json({
          success: true,
          content: result.content,
          usage: { used: newCount, limit },
        });
      }
    }

    return NextResponse.json({ success: true, content: result.content });
  } catch (error) {
    console.error("[AI Generate] Error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
