import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { getFromCache, setToCache } from "@/lib/redis";
import { askAi } from "@/lib/ai";
import { getSystemConfig } from "@/lib/config";
import { checkAiUsageLimit, incrementAiUsage } from "@/lib/ai-usage";

interface WeakCategory {
  category: string;
  errorCount: number;
  questions: string[];
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const cacheKey = `analytics:weak-points:${user.userId}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const wrongRecords = await prisma.userQuestionRecord.findMany({
      where: { userId: user.userId, isCorrect: false },
      include: {
        question: {
          select: {
            content: true,
            answer: true,
            bank: { select: { category: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const categoryMap = new Map<string, WeakCategory>();
    for (const record of wrongRecords) {
      const category = record.question.bank.category || "未分类";
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, errorCount: 0, questions: [] });
      }
      const entry = categoryMap.get(category)!;
      entry.errorCount++;
      if (entry.questions.length < 10) {
        entry.questions.push(record.question.content);
      }
    }

    const weakCategories = Array.from(categoryMap.values()).filter(
      (c) => c.errorCount > 3
    );

    if (weakCategories.length === 0) {
      const data = { weakPoints: [] };
      await setToCache(cacheKey, data, 600);
      return Response.json(data);
    }

    const aiEnabled = await getSystemConfig("ai_enabled");
    if (aiEnabled !== "true") {
      const data = {
        weakPoints: weakCategories.map((c) => ({
          category: c.category,
          errorCount: c.errorCount,
          knowledgeGaps: [],
          suggestion: `该类别有 ${c.errorCount} 道错题，建议重点复习`,
        })),
      };
      await setToCache(cacheKey, data, 600);
      return Response.json(data);
    }

    const usageCheck = await checkAiUsageLimit(user.userId);
    if (!usageCheck.allowed) {
      const data = {
        weakPoints: weakCategories.map((c) => ({
          category: c.category,
          errorCount: c.errorCount,
          knowledgeGaps: [],
          suggestion: `当日 AI 分析次数已用完，该类别有 ${c.errorCount} 道错题`,
        })),
        usage: { used: usageCheck.used, limit: usageCheck.limit },
      };
      await setToCache(cacheKey, data, 600);
      return Response.json(data);
    }

    const categoriesSummary = weakCategories
      .map((c) => {
        const sampleQuestions = c.questions.slice(0, 10).join("；");
        return `分类: ${c.category}, 错题数: ${c.errorCount}, 错题示例: ${sampleQuestions}`;
      })
      .join("\n");

    const prompt = `请分析以下错题数据，识别每个分类中的薄弱知识点，并给出针对性学习建议。返回严格的 JSON 数组格式（不要使用 Markdown 代码块）：

${categoriesSummary}

返回格式：
[
  {
    "category": "分类名称",
    "knowledgeGaps": ["薄弱知识点1", "薄弱知识点2"],
    "suggestion": "具体的学习建议"
  }
]

注意：
- knowledgeGaps 中只列出该用户真正薄弱的、容易混淆的知识点
- suggestion 应该具体、可操作，不要泛泛而谈
- 必须返回 JSON 数组，不要使用 \`\`\` 代码块`;

    const aiResult = await askAi(
      prompt,
      "你是一位考试辅导专家，请用中文回答，严格返回 JSON 数组格式。"
    );

    let aiWeakPoints: any[] = [];
    if (aiResult.success) {
      try {
        let content = aiResult.content.trim();
        content = content
          .replace(/```json\s*/gi, "")
          .replace(/```\s*/g, "")
          .trim();
        aiWeakPoints = JSON.parse(content);
      } catch {
        aiWeakPoints = weakCategories.map((c) => ({
          category: c.category,
          knowledgeGaps: ["需进一步分析"],
          suggestion: `建议重点复习 ${c.category}，当前错题数: ${c.errorCount}`,
        }));
      }
    } else {
      aiWeakPoints = weakCategories.map((c) => ({
        category: c.category,
        knowledgeGaps: ["AI 分析暂不可用"],
        suggestion: `建议重点复习 ${c.category}，当前错题数: ${c.errorCount}`,
      }));
    }

    await incrementAiUsage(user.userId);

    const updatedUsage = {
      used: usageCheck.used + 1,
      limit: usageCheck.limit,
    };

    const data = {
      weakPoints: aiWeakPoints,
      usage: updatedUsage,
    };

    await setToCache(cacheKey, data, 600);

    return Response.json(data);
  } catch (error: any) {
    console.error("获取薄弱知识点分析失败:", error);
    return Response.json(
      { error: "获取薄弱知识点分析失败，请稍后重试" },
      { status: 500 }
    );
  }
}
