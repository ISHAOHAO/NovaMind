import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { askAi } from "@/lib/ai";
import { getSystemConfig } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const usageKey = `ai_note_summary:${user.userId}:${today}`;

    const limit = parseInt(
      await getSystemConfig("ai_note_summary_daily_limit", "5"),
      10
    );
    const used = parseInt((await redis.get(usageKey)) || "0", 10);

    if (used >= limit) {
      return Response.json(
        { error: `当日 AI 笔记总结次数已达上限 (${used}/${limit})，请明天再试` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { noteIds } = body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return Response.json({ error: "请提供要总结的笔记ID列表" }, { status: 400 });
    }

    const notes = await prisma.note.findMany({
      where: {
        id: { in: noteIds },
        userId: user.userId,
      },
      include: {
        question: {
          select: {
            content: true,
            answer: true,
            analysis: true,
            bank: {
              select: {
                title: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (notes.length === 0) {
      return Response.json({ error: "未找到笔记" }, { status: 404 });
    }

    const notesContent = notes
      .map((note, index) => {
        return `### 笔记 ${index + 1}
题目：${note.question.content}
答案：${note.question.answer}
${note.question.analysis ? `解析：${note.question.analysis}` : ""}
笔记内容：${note.content}
${note.question.bank ? `所属题库：${note.question.bank.title} (${note.question.bank.category})` : ""}`;
      })
      .join("\n\n---\n\n");

    const result = await askAi(
      `请总结以下题目的关键知识点：\n\n${notesContent}`,
      "你是专业的考试辅导老师，请以中文输出，使用HTML格式，包含标题、知识点列表、注意事项等结构，便于阅读。"
    );

    if (!result.success) {
      return Response.json({ error: result.error || "AI 总结失败" }, { status: 500 });
    }

    await redis.incr(usageKey);
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ttlSeconds = Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);
    await redis.expire(usageKey, ttlSeconds);

    await prisma.note.updateMany({
      where: {
        id: { in: noteIds },
        userId: user.userId,
      },
      data: { isAiGenerated: true },
    });

    return Response.json({ summary: result.content });
  } catch (error: any) {
    console.error("AI笔记总结失败:", error);
    return Response.json({ error: "AI笔记总结失败，请稍后重试" }, { status: 500 });
  }
}
