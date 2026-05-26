import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { questionBankId, questionId, reason } = body;

    if (!questionBankId || !reason || !reason.trim()) {
      return NextResponse.json({ error: "请提供题库ID和反馈原因" }, { status: 400 });
    }

    if (reason.trim().length < 5) {
      return NextResponse.json({ error: "反馈原因至少需要5个字符" }, { status: 400 });
    }

    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      select: { id: true },
    });

    if (!bank) {
      return NextResponse.json({ error: "题库不存在" }, { status: 404 });
    }

    if (questionId) {
      const question = await prisma.question.findFirst({
        where: { id: questionId, bankId: questionBankId },
        select: { id: true },
      });
      if (!question) {
        return NextResponse.json({ error: "题目不存在" }, { status: 404 });
      }
    }

    const existing = await prisma.report.findFirst({
      where: {
        reporterId: user.userId,
        questionBankId,
        questionId: questionId || null,
        status: "PENDING",
      },
    });

    if (existing) {
      return NextResponse.json({ error: "您已反馈过该内容，请等待处理" }, { status: 409 });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.userId,
        questionBankId,
        questionId: questionId || null,
        reason: reason.trim(),
      },
    });

    return NextResponse.json({ report, message: "反馈已提交，管理员会尽快处理" });
  } catch (error) {
    console.error("[Reports] Error:", error);
    return NextResponse.json({ error: "提交反馈失败" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const reports = await prisma.report.findMany({
      where: { reporterId: user.userId },
      include: {
        questionBank: { select: { id: true, title: true } },
        question: { select: { id: true, content: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("[Reports] Error:", error);
    return NextResponse.json({ error: "获取反馈列表失败" }, { status: 500 });
  }
}
