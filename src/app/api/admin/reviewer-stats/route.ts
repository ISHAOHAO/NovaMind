import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFromCache, setToCache } from "@/lib/redis";

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "";
    const days = Math.max(1, parseInt(searchParams.get("days") || "30", 10));

    const cacheKey = `admin:reviewer-stats:${userId}:${days}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const where: any = {
      date: { gte: startDate },
    };
    if (userId) {
      where.userId = userId;
    }

    const stats = await prisma.reviewerDailyStats.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const userStatsMap = new Map<string, {
      userId: string;
      userName: string;
      totalReviewed: number;
      totalApproved: number;
      totalRejected: number;
      totalNeedsRevision: number;
      totalReviewTime: number;
      reviewCount: number;
    }>();

    stats.forEach((s) => {
      let entry = userStatsMap.get(s.userId);
      if (!entry) {
        entry = {
          userId: s.userId,
          userName: "",
          totalReviewed: 0,
          totalApproved: 0,
          totalRejected: 0,
          totalNeedsRevision: 0,
          totalReviewTime: 0,
          reviewCount: 0,
        };
        userStatsMap.set(s.userId, entry);
      }
      entry.totalReviewed += s.reviewedCount;
      entry.totalApproved += s.approvedCount;
      entry.totalRejected += s.rejectedCount;
      entry.totalNeedsRevision += s.needsRevisionCount;
      if (s.avgReviewTime > 0) {
        entry.totalReviewTime += s.avgReviewTime;
        entry.reviewCount++;
      }
    });

    if (userStatsMap.size > 0) {
      const userIds = Array.from(userStatsMap.keys());
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });

      users.forEach((u) => {
        const entry = userStatsMap.get(u.id);
        if (entry) {
          entry.userName = u.name || u.email;
        }
      });
    }

    const result = Array.from(userStatsMap.values()).map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      totalReviewed: entry.totalReviewed,
      totalApproved: entry.totalApproved,
      totalRejected: entry.totalRejected,
      totalNeedsRevision: entry.totalNeedsRevision,
      avgReviewTime: entry.reviewCount > 0
        ? Math.round(entry.totalReviewTime / entry.reviewCount)
        : 0,
    }));

    const responseData = { stats: result };

    await setToCache(cacheKey, responseData, 60);

    return Response.json(responseData);
  } catch (error) {
    console.error("获取审核绩效失败:", error);
    return Response.json({ error: "获取审核绩效失败" }, { status: 500 });
  }
});
