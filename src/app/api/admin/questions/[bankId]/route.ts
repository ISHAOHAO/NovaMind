import { NextRequest } from "next/server";
import { requireAdmin, TokenPayload } from "@/lib/auth";
import prisma from "@/lib/prisma";
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
        reviewer: {
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
    const { status, comment, reviewTemplateId } = body;

    const bank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      select: {
        id: true,
        title: true,
        status: true,
        isPublic: true,
        reviewedById: true,
        reviewTemplateId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    const validStatuses = ["PENDING", "REVIEWING", "APPROVED", "REJECTED", "NEEDS_REVISION"];

    if (status && validStatuses.includes(status)) {
      const updateData: any = {};
      const logActions: string[] = [];

      updateData.status = status;

      if (comment !== undefined) {
        updateData.reviewComment = comment;
      }
      if (reviewTemplateId !== undefined) {
        updateData.reviewTemplateId = reviewTemplateId || null;
      }

      if (status === "REVIEWING" && bank.status !== "REVIEWING") {
        updateData.reviewedById = currentUser.userId;
        logActions.push("开始审核");
      }

      if (["APPROVED", "REJECTED", "NEEDS_REVISION"].includes(status)) {
        updateData.reviewedAt = new Date();
        if (!bank.reviewedById) {
          updateData.reviewedById = currentUser.userId;
        }
        logActions.push(
          status === "APPROVED" ? "通过" : status === "REJECTED" ? "驳回" : "需修改"
        );
      }

      const updated = await prisma.questionBank.update({
        where: { id: bankId },
        data: updateData,
      });

      await prisma.auditLog.create({
        data: {
          userId: currentUser.userId,
          action: "QUESTION_REVIEW",
          details: `审核题库: ${bank.title}, 状态: ${status}${logActions.length > 0 ? ", 操作: " + logActions.join(", ") : ""}${comment ? `, 评语: ${comment}` : ""}`,
          ip: null,
          userAgent: req.headers.get("user-agent") || null,
        },
      });

      if (["APPROVED", "REJECTED", "NEEDS_REVISION"].includes(status)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const reviewTime = Math.floor((Date.now() - new Date(bank.updatedAt).getTime()) / 1000);

        const statsData: any = {
          reviewedCount: { increment: 1 },
        };

        if (status === "APPROVED") {
          statsData.approvedCount = { increment: 1 };
        } else if (status === "REJECTED") {
          statsData.rejectedCount = { increment: 1 };
        } else if (status === "NEEDS_REVISION") {
          statsData.needsRevisionCount = { increment: 1 };
        }

        await prisma.reviewerDailyStats.upsert({
          where: {
            userId_date: {
              userId: currentUser.userId,
              date: today,
            },
          },
          update: statsData,
          create: {
            userId: currentUser.userId,
            date: today,
            reviewedCount: 1,
            approvedCount: status === "APPROVED" ? 1 : 0,
            rejectedCount: status === "REJECTED" ? 1 : 0,
            needsRevisionCount: status === "NEEDS_REVISION" ? 1 : 0,
            avgReviewTime: reviewTime,
          },
        });
      }

      await invalidatePattern("questions:list:*");
      await invalidatePattern("admin:questions:list:*");

      const statusLabels: Record<string, string> = {
        PENDING: "待审核",
        REVIEWING: "审核中",
        APPROVED: "已通过",
        REJECTED: "已驳回",
        NEEDS_REVISION: "需修改",
      };

      return Response.json({
        bank: updated,
        message: `题库已标记为${statusLabels[status] || status}`,
      });
    }

    const updateData: any = {};
    const actions: string[] = [];

    if (typeof body.isPublic === "boolean") {
      updateData.isPublic = body.isPublic;
      actions.push(body.isPublic ? "公开题库" : "隐藏题库");
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
    await invalidatePattern("admin:questions:list:*");

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
    await invalidatePattern("admin:questions:list:*");

    return Response.json({ message: "题库已删除" });
  } catch (error) {
    console.error("删除题库失败:", error);
    return Response.json({ error: "删除题库失败" }, { status: 500 });
  }
});
