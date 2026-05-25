import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const GET = requireAdmin(async (_req: NextRequest) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    bannedUsers,
    totalQuestionBanks,
    pendingQuestionBanks,
    totalQuestions,
    totalActivationCodes,
    usedActivationCodes,
    todayNewUsers,
    todayLogins,
    todayRecords,
    recentUsers,
    recentLogs,
    weeklyRegistrations,
    dailyRecords,
    roleDistribution,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { banned: false, deletedAt: null } }),
    prisma.user.count({ where: { banned: true, deletedAt: null } }),
    prisma.questionBank.count(),
    prisma.questionBank.count({ where: { status: "PENDING" } }),
    prisma.question.count(),
    prisma.activationCode.count(),
    prisma.activationCode.count({ where: { isUsed: true } }),
    prisma.user.count({
      where: { createdAt: { gte: todayStart }, deletedAt: null },
    }),
    prisma.auditLog.count({
      where: { action: "LOGIN", createdAt: { gte: todayStart } },
    }),
    prisma.userQuestionRecord.count({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.user.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: weekAgo }, deletedAt: null },
      _count: { id: true },
    }),
    prisma.userQuestionRecord.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: weekAgo } },
      _count: { id: true },
    }),
    prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { id: true },
    }),
  ]);

  const roleMap: Record<string, number> = {};
  for (const r of roleDistribution) {
    roleMap[r.role] = r._count.id;
  }

  const unusedCount = totalActivationCodes - usedActivationCodes;

  return Response.json({
    totalUsers,
    activeUsers,
    bannedUsers,
    totalQuestionBanks,
    pendingQuestionBanks,
    totalQuestions,
    totalActivationCodes,
    usedActivationCodes,
    todayNewUsers,
    todayLogins,
    todayRecords,
    recentUsers,
    recentLogs,
    weeklyRegistrations: weeklyRegistrations.map((r) => ({
      date: r.createdAt.toISOString().split("T")[0],
      count: r._count.id,
    })),
    dailyRecords: dailyRecords.map((r) => ({
      date: r.createdAt.toISOString().split("T")[0],
      count: r._count.id,
    })),
    roleDistribution: {
      USER: roleMap["USER"] ?? 0,
      ADMIN: roleMap["ADMIN"] ?? 0,
      SUPER_ADMIN: roleMap["SUPER_ADMIN"] ?? 0,
    },
    activationUsage: totalActivationCodes > 0
      ? Math.round((usedActivationCodes / totalActivationCodes) * 100)
      : 0,
    unusedActivationCodes: unusedCount,
  });
});
