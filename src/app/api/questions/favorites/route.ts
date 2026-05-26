import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { formatDate, getDifficultyLabel } from "@/lib/utils";
import { deleteFromCache } from "@/lib/redis";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          question: {
            select: {
              id: true,
              type: true,
              content: true,
              options: true,
              answer: true,
              analysis: true,
              createdAt: true,
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
      }),
      prisma.favorite.count({ where: { userId: user.userId } }),
    ]);

    const result = favorites.map((fav) => ({
      id: fav.id,
      favoritedAt: formatDate(fav.createdAt),
      question: {
        id: fav.question.id,
        type: fav.question.type,
        content: fav.question.content,
        options: fav.question.options,
        answer: fav.question.answer,
        analysis: fav.question.analysis,
        bank: fav.question.bank
          ? {
              id: fav.question.bank.id,
              title: fav.question.bank.title,
              difficulty: fav.question.bank.difficulty,
              difficultyLabel: getDifficultyLabel(fav.question.bank.difficulty),
            }
          : null,
        createdAt: formatDate(fav.question.createdAt),
      },
    }));

    return Response.json({
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("获取收藏列表失败:", error);
    return Response.json({ error: "获取收藏列表失败，请稍后重试" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const { questionId } = body;

    if (!questionId) {
      return Response.json({ error: "缺少 questionId" }, { status: 400 });
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      return Response.json({ error: "题目不存在" }, { status: 404 });
    }

    const existing = await prisma.favorite.findUnique({
      where: { userId_questionId: { userId: user.userId, questionId } },
    });

    let isFavorited: boolean;

    if (existing) {
      await prisma.favorite.delete({
        where: { userId_questionId: { userId: user.userId, questionId } },
      });
      isFavorited = false;
    } else {
      await prisma.favorite.create({
        data: { userId: user.userId, questionId },
      });
      isFavorited = true;
    }

    deleteFromCache(`dashboard:${user.userId}`).catch(() => {});

    return Response.json({
      data: { questionId, isFavorited },
      message: isFavorited ? "已收藏" : "已取消收藏",
    });
  } catch (error: any) {
    console.error("切换收藏状态失败:", error);
    return Response.json({ error: "操作失败，请稍后重试" }, { status: 500 });
  }
}
