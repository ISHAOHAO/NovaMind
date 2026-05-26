import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFromCache, setToCache } from "@/lib/redis";

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const ip = searchParams.get("ip") || "";
    const email = searchParams.get("email") || "";
    const success = searchParams.get("success");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
    const skip = (page - 1) * limit;

    const cacheKey = `admin:risk-control:attempts:${ip}:${email}:${success || ""}:${from}:${to}:${page}:${limit}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const where: any = {};
    if (ip) where.ip = { contains: ip };
    if (email) where.email = { contains: email };
    if (success === "true") where.success = true;
    if (success === "false") where.success = false;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [attempts, total] = await Promise.all([
      prisma.loginAttempt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.loginAttempt.count({ where }),
    ]);

    const responseData = {
      attempts,
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
    console.error("获取登录记录失败:", error);
    return Response.json({ error: "获取数据失败" }, { status: 500 });
  }
});
