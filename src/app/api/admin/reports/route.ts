import { NextRequest } from "next/server";
import { requireAdmin, TokenPayload } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFromCache, setToCache, invalidatePattern } from "@/lib/redis";

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const cacheKey = `admin:reports:list:${status}:${page}:${limit}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const where: any = {};
    if (status !== "all") {
      where.status = status;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, email: true, name: true } },
          questionBank: { select: { id: true, title: true } },
          question: { select: { id: true, content: true } },
          handler: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    const responseData = {
      reports,
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
    console.error("获取反馈列表失败:", error);
    return Response.json({ error: "获取反馈列表失败" }, { status: 500 });
  }
});

export const PUT = requireAdmin(async (req: NextRequest) => {
  try {
    const currentUser = (req as any).user as TokenPayload;
    const body = await req.json();
    const { id, status, handleNote } = body;

    if (!id || !status) {
      return Response.json({ error: "缺少参数" }, { status: 400 });
    }

    if (!["RESOLVED", "DISMISSED"].includes(status)) {
      return Response.json({ error: "无效的状态" }, { status: 400 });
    }

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return Response.json({ error: "反馈不存在" }, { status: 404 });
    }

    if (report.status !== "PENDING") {
      return Response.json({ error: "该反馈已处理" }, { status: 400 });
    }

    const updated = await prisma.report.update({
      where: { id },
      data: {
        status,
        handledById: currentUser.userId,
        handledAt: new Date(),
        handleNote: handleNote || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: status === "RESOLVED" ? "RESOLVE_REPORT" : "DISMISS_REPORT",
        details: JSON.stringify({ reportId: id }),
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    await invalidatePattern("admin:reports:list:*");

    const statusLabel = status === "RESOLVED" ? "已处理" : "已驳回";
    return Response.json({ report: updated, message: `反馈已标记为${statusLabel}` });
  } catch (error) {
    console.error("处理反馈失败:", error);
    return Response.json({ error: "处理反馈失败" }, { status: 500 });
  }
});
