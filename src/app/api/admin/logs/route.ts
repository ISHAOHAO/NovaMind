import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getFromCache, setToCache } from "@/lib/redis";

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || undefined;
    const action = searchParams.get("action") || undefined;
    const search = searchParams.get("search") || "";
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const cacheKey = `admin:logs:list:${userId || ""}:${action || ""}:${search}:${from || ""}:${to || ""}:${page}:${limit}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const where: Prisma.AuditLogWhereInput = {};

    if (userId) {
      where.userId = userId;
    }
    if (action) {
      where.action = action;
    }
    if (search) {
      where.details = { contains: search, mode: "insensitive" };
    }
    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        where.createdAt.lte = new Date(to);
      }
    }

    const [logs, total, uniqueActions] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          action: true,
          details: true,
          ip: true,
          userAgent: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
      getFromCache<string[]>("admin:logs:actions"),
    ]);

    let actions: string[];
    if (uniqueActions) {
      actions = uniqueActions;
    } else {
      const actionsResult = await prisma.auditLog.findMany({
        select: { action: true },
        distinct: ["action"],
        orderBy: { action: "asc" },
      });
      actions = actionsResult.map((a) => a.action);
      setToCache("admin:logs:actions", actions, 300).catch(() => {});
    }

    const responseData = {
      logs,
      actions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await setToCache(cacheKey, responseData, 30);

    return Response.json(responseData);
  } catch (error) {
    console.error("获取审计日志失败:", error);
    return Response.json({ error: "获取审计日志失败" }, { status: 500 });
  }
});
