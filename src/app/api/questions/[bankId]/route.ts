import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { questionBankSchema } from "@/lib/validations";
import { formatDate, getDifficultyLabel } from "@/lib/utils";
import { invalidatePattern, getFromCache, setToCache, deleteFromCache } from "@/lib/redis";

type RouteContext = { params: Promise<{ bankId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { bankId } = await context.params;

    const cacheKey = `questions:bank:${bankId}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const user = await authenticateRequest(req);

    const bank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      include: {
        uploader: { select: { id: true, name: true, avatar: true } },
        questions: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            type: true,
            content: true,
            options: true,
            answer: true,
            analysis: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    if (!bank.isPublic || bank.status !== "APPROVED") {
      if (!user) {
        return Response.json({ error: "该题库未公开" }, { status: 403 });
      }
      if (bank.uploaderId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        return Response.json({ error: "您没有权限查看该题库" }, { status: 403 });
      }
    }

    const result = {
      data: {
        id: bank.id,
        title: bank.title,
        description: bank.description,
        source: bank.source,
        category: bank.category,
        tags: bank.tags,
        difficulty: bank.difficulty,
        difficultyLabel: getDifficultyLabel(bank.difficulty),
        status: bank.status,
        isPublic: bank.isPublic,
        uploader: bank.uploader,
        questions: bank.questions,
        questionCount: bank.questions.length,
        createdAt: formatDate(bank.createdAt),
        updatedAt: formatDate(bank.updatedAt),
      },
    };

    await setToCache(cacheKey, result, 300);

    return Response.json(result);
  } catch (error: any) {
    console.error("获取题库详情失败:", error);
    return Response.json({ error: "获取题库详情失败，请稍后重试" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { bankId } = await context.params;

    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    if (bank.uploaderId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return Response.json({ error: "您没有权限修改该题库" }, { status: 403 });
    }

    const body = await req.json();

    const parsed = questionBankSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({
        error: "输入数据校验失败",
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const updatedBank = await prisma.questionBank.update({
      where: { id: bankId },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        source: parsed.data.source,
        category: parsed.data.category,
        tags: parsed.data.tags,
        difficulty: parsed.data.difficulty,
        isPublic: parsed.data.isPublic,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "QUESTION_BANK_UPDATE",
        details: JSON.stringify({ bankId: updatedBank.id, title: updatedBank.title }),
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    await deleteFromCache(`questions:bank:${bankId}`);
    await invalidatePattern(`questions:*:${bankId}:*`);

    return Response.json({
      data: {
        id: updatedBank.id,
        title: updatedBank.title,
        updatedAt: formatDate(updatedBank.updatedAt),
      },
      message: "题库更新成功",
    });
  } catch (error: any) {
    console.error("更新题库失败:", error);
    return Response.json({ error: "更新题库失败，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { bankId } = await context.params;

    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    if (bank.uploaderId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return Response.json({ error: "您没有权限删除该题库" }, { status: 403 });
    }

    await prisma.questionBank.delete({ where: { id: bankId } });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "QUESTION_BANK_DELETE",
        details: JSON.stringify({ bankId: bank.id, title: bank.title }),
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    await deleteFromCache(`questions:bank:${bankId}`);
    await invalidatePattern(`questions:*:${bankId}:*`);
    await invalidatePattern("questions:list:*");

    return Response.json({ message: "题库已删除" });
  } catch (error: any) {
    console.error("删除题库失败:", error);
    return Response.json({ error: "删除题库失败，请稍后重试" }, { status: 500 });
  }
}
