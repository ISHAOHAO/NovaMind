import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

/**
 * 复习提醒（艾宾浩斯遗忘曲线简化版）：
 * - 取该用户 isCorrect=false 的答题记录，按 questionId 汇总最后一次答错时间
 *   与错误次数；
 * - 第 n 次答错的题，到期时间 = lastWrongAt + intervals[min(n-1, 5)] 天，
 *   间隔序列为 [1, 2, 4, 7, 15, 30] 天；
 * - 最后一次正确记录晚于最后一次错误记录的题视为已掌握，移出复习；
 * - now >= 到期时间即为待复习，按到期时间升序返回（上限 500）。
 */
const REVIEW_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RECORDS = 20000;
const MAX_DUE = 500;

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const bankId = searchParams.get("bankId") || "";

    const where: Record<string, unknown> = { userId: user.userId, isCorrect: false };
    if (bankId) {
      where.question = { bankId };
    }

    const wrongRecords = await prisma.userQuestionRecord.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: { questionId: true, createdAt: true },
      take: MAX_RECORDS,
    });

    if (wrongRecords.length === 0) {
      return Response.json({ count: 0, questionIds: [] });
    }

    // 按 questionId 汇总最后一次答错时间与错误次数
    const stats = new Map<string, { lastWrongAt: Date; count: number }>();
    for (const record of wrongRecords) {
      const existing = stats.get(record.questionId);
      if (existing) {
        existing.count += 1;
        if (record.createdAt > existing.lastWrongAt) {
          existing.lastWrongAt = record.createdAt;
        }
      } else {
        stats.set(record.questionId, { lastWrongAt: record.createdAt, count: 1 });
      }
    }

    // 最后一次正确记录晚于最后一次错误的题视为已掌握
    const correctRecords = await prisma.userQuestionRecord.findMany({
      where: {
        userId: user.userId,
        isCorrect: true,
        questionId: { in: Array.from(stats.keys()) },
      },
      select: { questionId: true, createdAt: true },
      take: MAX_RECORDS,
    });
    const lastCorrectAt = new Map<string, Date>();
    for (const record of correctRecords) {
      const existing = lastCorrectAt.get(record.questionId);
      if (!existing || record.createdAt > existing) {
        lastCorrectAt.set(record.questionId, record.createdAt);
      }
    }

    const now = Date.now();
    const due: { questionId: string; dueAt: number }[] = [];
    for (const [questionId, stat] of stats) {
      const masteredAt = lastCorrectAt.get(questionId);
      if (masteredAt && masteredAt > stat.lastWrongAt) continue;

      const intervalIdx = Math.min(stat.count - 1, REVIEW_INTERVALS_DAYS.length - 1);
      const dueAt = stat.lastWrongAt.getTime() + REVIEW_INTERVALS_DAYS[intervalIdx] * DAY_MS;
      if (now >= dueAt) {
        due.push({ questionId, dueAt });
      }
    }

    due.sort((a, b) => a.dueAt - b.dueAt);
    const questionIds = due.slice(0, MAX_DUE).map((d) => d.questionId);

    const result: Record<string, unknown> = {
      count: due.length,
      questionIds,
    };

    // 未指定题库时附带按题库聚合的数量，便于题库列表页跳转到最相关的题库
    if (!bankId && questionIds.length > 0) {
      const bankGroups = await prisma.question.groupBy({
        by: ["bankId"],
        where: { id: { in: questionIds } },
        _count: { _all: true },
      });
      result.questionBanks = bankGroups
        .map((g) => ({ bankId: g.bankId, count: g._count._all }))
        .sort((a, b) => b.count - a.count);
    }

    return Response.json(result);
  } catch (error: any) {
    console.error("获取到期复习失败:", error);
    return Response.json({ error: "获取到期复习失败，请稍后重试" }, { status: 500 });
  }
}
