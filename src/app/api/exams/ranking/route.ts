import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId");

    if (!examId) {
      return Response.json({ error: "请提供考试ID" }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true },
    });

    if (!exam) {
      return Response.json({ error: "考试不存在" }, { status: 404 });
    }

    const completedExams = await prisma.exam.findMany({
      where: {
        id: examId,
        status: "COMPLETED",
      },
      orderBy: { score: "desc" },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    const rankingFallback = await prisma.exam.findMany({
      where: {
        title: exam.title,
        status: "COMPLETED",
      },
      orderBy: { score: "desc" },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    const source = completedExams.length > 0 ? completedExams : rankingFallback;

    const rankings = source.map((e, index) => ({
      rank: index + 1,
      userId: e.user.id,
      userName: e.user.name || "未知用户",
      userAvatar: e.user.avatar,
      score: e.score,
      correctCount: e.correctCount,
      totalQuestions: e.totalQuestions,
      completedAt: e.completedAt ? formatDate(e.completedAt) : null,
      duration: e.startedAt && e.completedAt
        ? Math.round((e.completedAt.getTime() - e.startedAt.getTime()) / 1000 / 60)
        : null,
    }));

    const currentUserRank = rankings.findIndex((r) => r.userId === user.userId);
    const currentUserRankResult = currentUserRank >= 0
      ? rankings[currentUserRank]
      : null;

    return Response.json({
      rankings,
      currentUserRank: currentUserRankResult || null,
    });
  } catch (error: any) {
    console.error("获取排名失败:", error);
    return Response.json({ error: "获取排名失败，请稍后重试" }, { status: 500 });
  }
}
