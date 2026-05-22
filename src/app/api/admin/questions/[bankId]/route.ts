import { NextRequest } from "next/server";
import { requireAdmin, TokenPayload } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { reviewQuestionSchema } from "@/lib/validations";
import { invalidatePattern } from "@/lib/redis";

export const GET = requireAdmin(async (req: NextRequest, { params }: { params: Promise<{ bankId: string }> }) => {
  try {
    const { bankId } = await params;

    const bank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      include: {
        uploader: {
          select: { id: true, email: true, name: true },
        },
        questions: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    return Response.json({ bank });
  } catch (error) {
    console.error("获取题库详情失败:", error);
    return Response.json({ error: "获取题库详情失败" }, { status: 500 });
  }
});

export const PUT = requireAdmin(async (req: NextRequest, { params }: { params: Promise<{ bankId: string }> }) => {
  try {
    const { bankId } = await params;
    const currentUser = (req as any).user as TokenPayload;

    const body = await req.json();

    const bank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      select: { id: true, title: true, status: true, isPublic: true },
    });

    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    // Review mode: only for PENDING banks
    if (body.status && (body.status === "APPROVED" || body.status === "REJECTED")) {
      const parsed = reviewQuestionSchema.safeParse({
        bankId,
        status: body.status,
        comment: body.comment,
      });

      if (!parsed.success) {
        const errors = parsed.error.errors.map((e) => e.message).join("; ");
        return Response.json({ error: errors }, { status: 400 });
      }

      const { status, comment } = parsed.data;

      if (bank.status !== "PENDING") {
        return Response.json({ error: "该题库已被审核，无法重复审核" }, { status: 400 });
      }

      const updated = await prisma.questionBank.update({
        where: { id: bankId },
        data: {
          status,
          reviewComment: comment || null,
          reviewedById: currentUser.userId,
          reviewedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: currentUser.userId,
          action: status === "APPROVED" ? "APPROVE_BANK" : "REJECT_BANK",
          details: `${status === "APPROVED" ? "通过" : "驳回"}题库: ${bank.title}${comment ? `, 评语: ${comment}` : ""}`,
          ip: null,
          userAgent: req.headers.get("user-agent") || null,
        },
      });

      await invalidatePattern("questions:list:*");

      return Response.json({
        bank: updated,
        message: status === "APPROVED" ? "题库审核通过" : "题库已驳回",
      });
    }

    // Management mode: toggle isPublic or update other fields
    const updateData: any = {};
    const actions: string[] = [];

    if (typeof body.isPublic === "boolean") {
      updateData.isPublic = body.isPublic;
      actions.push(body.isPublic ? "公开题库" : "隐藏题库");
    }

    if (typeof body.status === "string" && ["APPROVED", "REJECTED", "PENDING"].includes(body.status)) {
      if (bank.status !== body.status) {
        updateData.status = body.status;
        actions.push(`修改状态为: ${body.status}`);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "没有可更新的字段" }, { status: 400 });
    }

    const updated = await prisma.questionBank.update({
      where: { id: bankId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "MANAGE_BANK",
        details: `管理题库 ${bank.title}: ${actions.join("; ")}`,
        ip: null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    await invalidatePattern("questions:list:*");

    return Response.json({
      bank: updated,
      message: "题库已更新",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "请求格式错误" }, { status: 400 });
    }
    console.error("管理题库失败:", error);
    return Response.json({ error: "管理题库失败" }, { status: 500 });
  }
});

export const DELETE = requireAdmin(async (req: NextRequest, { params }: { params: Promise<{ bankId: string }> }) => {
  try {
    const { bankId } = await params;
    const currentUser = (req as any).user as TokenPayload;

    const bank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      select: { id: true, title: true },
    });

    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    // Delete all related records first (questions cascade, but favorites/notes/records reference questions)
    const questions = await prisma.question.findMany({
      where: { bankId },
      select: { id: true },
    });
    const questionIds = questions.map((q) => q.id);

    if (questionIds.length > 0) {
      await prisma.$transaction([
        prisma.favorite.deleteMany({ where: { questionId: { in: questionIds } } }),
        prisma.note.deleteMany({ where: { questionId: { in: questionIds } } }),
        prisma.userQuestionRecord.deleteMany({ where: { questionId: { in: questionIds } } }),
        prisma.question.deleteMany({ where: { bankId } }),
      ]);
    }

    await prisma.questionBank.delete({ where: { id: bankId } });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "DELETE_BANK",
        details: `删除题库: ${bank.title} (${questionIds.length} 道题目)`,
        ip: null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    await invalidatePattern("questions:list:*");

    return Response.json({ message: "题库已删除" });
  } catch (error) {
    console.error("删除题库失败:", error);
    return Response.json({ error: "删除题库失败" }, { status: 500 });
  }
});
