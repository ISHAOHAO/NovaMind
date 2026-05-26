import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getFromCache, setToCache } from "@/lib/redis";

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || undefined;
    const banned = searchParams.get("banned");
    const isActivated = searchParams.get("isActivated");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const cacheKey = `admin:users:list:${search}:${role || ""}:${banned || ""}:${isActivated || ""}:${page}:${limit}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) {
      where.role = role as any;
    }
    if (banned === "true" || banned === "false") {
      where.banned = banned === "true";
    }
    if (isActivated === "true" || isActivated === "false") {
      where.isActivated = isActivated === "true";
    }

    const emailVerified = searchParams.get("emailVerified");
    if (emailVerified === "true" || emailVerified === "false") {
      where.emailVerified = emailVerified === "true";
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          avatar: true,
          role: true,
          isActivated: true,
          emailVerified: true,
          activatedAt: true,
          banned: true,
          bannedReason: true,
          bannedAt: true,
          lastLoginAt: true,
          lastLoginIp: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const responseData = {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await setToCache(cacheKey, responseData, 15);

    return Response.json(responseData);
  } catch (error) {
    console.error("获取用户列表失败:", error);
    return Response.json({ error: "获取用户列表失败" }, { status: 500 });
  }
});
