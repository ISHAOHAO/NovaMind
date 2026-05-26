import { NextRequest } from "next/server";
import { requireAdmin, TokenPayload } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addToBlacklist, removeFromBlacklist } from "@/lib/rate-limit";
import { getFromCache, setToCache, invalidatePattern } from "@/lib/redis";

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;
    const sortBy = searchParams.get("sortBy") || "failedCount";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const search = searchParams.get("search") || "";

    const cacheKey = `admin:risk-control:ips:${search}:${sortBy}:${sortOrder}:${page}:${limit}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const now = new Date();
    const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const orderBy: Record<string, string> = {};
    const allowedSortFields = ["failedCount", "totalCount", "successCount", "lastAttemptAt"];
    if (allowedSortFields.includes(sortBy)) {
      orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy.failedCount = "desc";
    }

    const ipFilter = search ? `WHERE la.ip ILIKE '%' || $1 || '%'` : "";
    const params: string[] = [];
    if (search) params.push(search);

    const baseParams = search ? [search] : [];
    const paramIdx24h = baseParams.length + 1;
    const paramIdx7d = baseParams.length + 2;

    const aggQuery = `
      SELECT
        la.ip,
        COUNT(*)::int as "totalCount",
        SUM(CASE WHEN la.success = false THEN 1 ELSE 0 END)::int as "failedCount",
        SUM(CASE WHEN la.success = true THEN 1 ELSE 0 END)::int as "successCount",
        MAX(la."createdAt") as "lastAttemptAt",
        COUNT(DISTINCT la.email)::int as "uniqueEmails",
        SUM(CASE WHEN la."createdAt" >= $${paramIdx24h} THEN 1 ELSE 0 END)::int as "recentCount",
        SUM(CASE WHEN la."createdAt" >= $${paramIdx24h} AND la.success = false THEN 1 ELSE 0 END)::int as "recentFailed"
      FROM "LoginAttempt" la
      ${ipFilter}
      GROUP BY la.ip
      ORDER BY "${sortBy === "failedCount" || sortBy === "totalCount" || sortBy === "successCount" || sortBy === "lastAttemptAt" ? sortBy : "failedCount"}" ${sortOrder === "asc" ? "ASC" : "DESC"}
    `;

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM (
        SELECT la.ip
        FROM "LoginAttempt" la
        ${ipFilter}
        GROUP BY la.ip
      ) sub
    `;

    const allParams = search ? [search, hours24Ago, days7Ago] : [hours24Ago, days7Ago];

    const [ipRows, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{
        ip: string;
        totalCount: number;
        failedCount: number;
        successCount: number;
        lastAttemptAt: Date;
        uniqueEmails: number;
        recentCount: number;
        recentFailed: number;
      }>>(
        `${aggQuery} LIMIT ${limit} OFFSET ${skip}`,
        ...allParams
      ),
      prisma.$queryRawUnsafe<Array<{ total: number }>>(countQuery, ...(search ? [search] : [])),
    ]);

    const blockedIps = await prisma.ipBlockRule.findMany({
      select: { ip: true },
    });
    const blockedIpSet = new Set(blockedIps.map((b) => b.ip));

    const ips = ipRows.map((row) => ({
      ...row,
      isBlocked: blockedIpSet.has(row.ip),
      riskLevel: row.failedCount > 20 ? "high" : row.failedCount > 10 ? "medium" : row.failedCount > 3 ? "low" : "normal",
    }));

    const responseData = {
      ips,
      pagination: {
        page,
        limit,
        total: countResult[0]?.total ?? 0,
        totalPages: Math.ceil((countResult[0]?.total ?? 0) / limit),
      },
    };

    await setToCache(cacheKey, responseData, 30);

    return Response.json(responseData);
  } catch (error) {
    console.error("获取IP列表失败:", error);
    return Response.json({ error: "获取数据失败" }, { status: 500 });
  }
});

export const POST = requireAdmin(async (req: NextRequest) => {
  try {
    const currentUser = (req as any).user as TokenPayload;
    const body = await req.json();
    const { ip, reason, durationHours } = body;

    if (!ip || typeof ip !== "string") {
      return Response.json({ error: "请提供IP地址" }, { status: 400 });
    }

    const existing = await prisma.ipBlockRule.findUnique({ where: { ip } });
    if (existing) {
      return Response.json({ error: "该IP已在封禁列表中" }, { status: 409 });
    }

    const expiresAt = durationHours
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
      : null;

    await prisma.ipBlockRule.create({
      data: {
        ip,
        reason: reason || null,
        blockedBy: currentUser.userId,
        expiresAt,
      },
    });

    await addToBlacklist(ip, expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 1000) : 7 * 24 * 3600);

    invalidatePattern("admin:risk-control:*").catch(() => {});

    return Response.json({ message: "IP已加入封禁列表" });
  } catch (error) {
    console.error("封禁IP失败:", error);
    return Response.json({ error: "操作失败" }, { status: 500 });
  }
});

export const DELETE = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const ip = searchParams.get("ip");

    if (!ip) {
      return Response.json({ error: "请提供IP地址" }, { status: 400 });
    }

    await prisma.ipBlockRule.deleteMany({ where: { ip } });
    await removeFromBlacklist(ip);

    invalidatePattern("admin:risk-control:*").catch(() => {});

    return Response.json({ message: "IP已从封禁列表移除" });
  } catch (error) {
    console.error("解封IP失败:", error);
    return Response.json({ error: "操作失败" }, { status: 500 });
  }
});
