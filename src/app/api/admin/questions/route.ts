import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getFromCache, setToCache } from "@/lib/redis";

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const cacheKey = `admin:questions:list:${status}:${search}:${category}:${page}:${limit}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const where: Prisma.QuestionBankWhereInput = {};

    if (status) {
      where.status = status as any;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { source: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const [banks, total] = await Promise.all([
      prisma.questionBank.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          source: true,
          category: true,
          tags: true,
          difficulty: true,
          status: true,
          isPublic: true,
          reviewComment: true,
          reviewedById: true,
          reviewedAt: true,
          reviewTemplateId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              questions: true,
            },
          },
          uploader: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.questionBank.count({ where }),
    ]);

    const responseData = {
      banks,
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
    console.error("获取题库列表失败:", error);
    return Response.json({ error: "获取题库列表失败" }, { status: 500 });
  }
});
