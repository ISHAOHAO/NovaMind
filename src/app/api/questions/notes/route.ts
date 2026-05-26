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
    const search = searchParams.get("search") || "";
    const importance = searchParams.get("importance");
    const isAiGenerated = searchParams.get("isAiGenerated");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = { userId: user.userId };

    if (questionId) {
      where.questionId = questionId;
    }
    if (search) {
      where.content = { contains: search, mode: "insensitive" };
    }
    if (importance !== null && importance !== undefined && importance !== "") {
      where.importance = parseInt(importance, 10);
    }
    if (isAiGenerated === "true") {
      where.isAiGenerated = true;
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
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
                  category: true,
                },
              },
            },
          },
        },
      }),
      prisma.note.count({ where }),
    ]);

    const result = notes.map((note) => ({
      id: note.id,
      questionId: note.questionId,
      content: note.content,
      importance: note.importance,
      isAiGenerated: note.isAiGenerated,
      question: {
        id: note.question.id,
        type: note.question.type,
        content: note.question.content,
        bank: note.question.bank
          ? {
              id: note.question.bank.id,
              title: note.question.bank.title,
              category: note.question.bank.category,
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
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
    const { questionId, content, importance, isAiGenerated } = body;

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

    const updateData: any = { content: String(content) };
    if (typeof importance === "number" && importance >= 0 && importance <= 5) {
      updateData.importance = importance;
    }
    if (typeof isAiGenerated === "boolean") {
      updateData.isAiGenerated = isAiGenerated;
    }

    const note = await prisma.note.upsert({
      where: {
        userId_questionId: { userId: user.userId, questionId },
      },
      update: updateData,
      create: {
        userId: user.userId,
        questionId,
        content: String(content),
        importance: typeof importance === "number" && importance >= 0 && importance <= 5 ? importance : 0,
        isAiGenerated: typeof isAiGenerated === "boolean" ? isAiGenerated : false,
      },
    });

    return Response.json({
      data: {
        id: note.id,
        questionId: note.questionId,
        content: note.content,
        importance: note.importance,
        isAiGenerated: note.isAiGenerated,
        updatedAt: formatDate(note.updatedAt),
      },
      message: "笔记已保存",
    });
  } catch (error: any) {
    console.error("保存笔记失败:", error);
    return Response.json({ error: "保存笔记失败，请稍后重试" }, { status: 500 });
  }
}
