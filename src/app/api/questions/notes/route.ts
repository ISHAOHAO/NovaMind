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
    const questionId = searchParams.get("questionId");

    const where: any = { userId: user.userId };

    if (questionId) {
      where.questionId = questionId;
    }

    const notes = await prisma.note.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        question: {
          select: {
            id: true,
            type: true,
            content: true,
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
    });

    const result = notes.map((note) => ({
      id: note.id,
      questionId: note.questionId,
      content: note.content,
      question: {
        id: note.question.id,
        type: note.question.type,
        content: note.question.content,
        bank: note.question.bank
          ? {
              id: note.question.bank.id,
              title: note.question.bank.title,
              difficulty: note.question.bank.difficulty,
              difficultyLabel: getDifficultyLabel(note.question.bank.difficulty),
            }
          : null,
      },
      createdAt: formatDate(note.createdAt),
      updatedAt: formatDate(note.updatedAt),
    }));

    return Response.json({
      data: result,
      total: result.length,
    });
  } catch (error: any) {
    console.error("获取笔记失败:", error);
    return Response.json({ error: "获取笔记失败，请稍后重试" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const { questionId, content } = body;

    if (!questionId) {
      return Response.json({ error: "缺少 questionId" }, { status: 400 });
    }

    if (content === undefined || content === null) {
      return Response.json({ error: "缺少 content" }, { status: 400 });
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      return Response.json({ error: "题目不存在" }, { status: 404 });
    }

    const note = await prisma.note.upsert({
      where: {
        userId_questionId: { userId: user.userId, questionId },
      },
      update: { content: String(content) },
      create: {
        userId: user.userId,
        questionId,
        content: String(content),
      },
    });

    return Response.json({
      data: {
        id: note.id,
        questionId: note.questionId,
        content: note.content,
        updatedAt: formatDate(note.updatedAt),
      },
      message: "笔记已保存",
    });
  } catch (error: any) {
    console.error("保存笔记失败:", error);
    return Response.json({ error: "保存笔记失败，请稍后重试" }, { status: 500 });
  }
}
