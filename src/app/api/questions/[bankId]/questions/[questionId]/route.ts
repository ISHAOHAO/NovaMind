import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { questionSchema } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { invalidatePattern } from "@/lib/redis";

type RouteContext = { params: Promise<{ bankId: string; questionId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { bankId, questionId } = await context.params;

    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    const question = await prisma.question.findFirst({
      where: { id: questionId, bankId },
    });

    if (!question) {
      return Response.json({ error: "题目不存在" }, { status: 404 });
    }

    const result = {
      id: question.id,
      bankId: question.bankId,
      type: question.type,
      content: question.content,
      options: typeof question.options === "string" ? JSON.parse(question.options) : question.options,
      answer: question.answer,
      analysis: question.analysis,
      image: question.image,
      sortOrder: question.sortOrder,
      createdAt: formatDate(question.createdAt),
      updatedAt: formatDate(question.updatedAt),
    };

    return Response.json({ data: result });
  } catch (error: any) {
    console.error("获取题目详情失败:", error);
    return Response.json({ error: "获取题目详情失败，请稍后重试" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { bankId, questionId } = await context.params;

    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    if (bank.uploaderId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return Response.json({ error: "您没有权限修改该题目" }, { status: 403 });
    }

    const question = await prisma.question.findFirst({
      where: { id: questionId, bankId },
    });

    if (!question) {
      return Response.json({ error: "题目不存在" }, { status: 404 });
    }

    const body = await req.json();

    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({
        error: "输入数据校验失败",
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const updated = await prisma.question.update({
      where: { id: questionId },
      data: {
        type: parsed.data.type,
        content: parsed.data.content,
        options: parsed.data.options || [],
        answer: parsed.data.answer,
        analysis: parsed.data.analysis,
        image: parsed.data.image || null,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "QUESTION_UPDATE",
        details: JSON.stringify({ bankId, questionId }),
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    await invalidatePattern(`questions:*:${bankId}:*`);

    return Response.json({
      data: {
        id: updated.id,
        content: updated.content,
        updatedAt: formatDate(updated.updatedAt),
      },
      message: "题目更新成功",
    });
  } catch (error: any) {
    console.error("更新题目失败:", error);
    return Response.json({ error: "更新题目失败，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { bankId, questionId } = await context.params;

    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    if (bank.uploaderId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return Response.json({ error: "您没有权限删除该题目" }, { status: 403 });
    }

    const question = await prisma.question.findFirst({
      where: { id: questionId, bankId },
    });

    if (!question) {
      return Response.json({ error: "题目不存在" }, { status: 404 });
    }

    await prisma.question.delete({ where: { id: questionId } });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "QUESTION_DELETE",
        details: JSON.stringify({ bankId, questionId }),
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    await invalidatePattern(`questions:*:${bankId}:*`);

    return Response.json({ message: "题目已删除" });
  } catch (error: any) {
    console.error("删除题目失败:", error);
    return Response.json({ error: "删除题目失败，请稍后重试" }, { status: 500 });
  }
}
