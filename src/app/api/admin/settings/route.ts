import { NextRequest } from "next/server";
import { requireAdmin, TokenPayload } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFromCache, setToCache, deleteFromCache } from "@/lib/redis";

export const GET = requireAdmin(async (_req: NextRequest) => {
  try {
    const cacheKey = "admin:settings";
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        updatedAt: true,
      },
    });

    const data = { configs };
    await setToCache(cacheKey, data, 300);

    return Response.json(data);
  } catch (error) {
    console.error("获取系统配置失败:", error);
    return Response.json({ error: "获取系统配置失败" }, { status: 500 });
  }
});

export const PUT = requireAdmin(async (req: NextRequest) => {
  try {
    const currentUser = (req as any).user as TokenPayload;
    const body = await req.json();

    if (!Array.isArray(body) || body.length === 0) {
      return Response.json({ error: "请提供有效的配置数组 [{key, value}]" }, { status: 400 });
    }

    const results: { key: string; success: boolean }[] = [];
    const errors: { key: string; error: string }[] = [];

    for (const item of body) {
      if (!item.key || typeof item.key !== "string" || typeof item.value !== "string") {
        errors.push({ key: item.key || "(未知)", error: "key 和 value 必须为字符串" });
        continue;
      }

      try {
        await prisma.systemConfig.upsert({
          where: { key: item.key },
          update: { value: item.value },
          create: { key: item.key, value: item.value, description: "" },
        });
        results.push({ key: item.key, success: true });
      } catch (err: any) {
        errors.push({ key: item.key, error: err?.message || "保存失败" });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "UPDATE_SETTINGS",
        details: `更新系统配置: ${results.map((r) => r.key).join(", ")}`,
        ip: (req as any).clientIp || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    deleteFromCache("admin:settings").catch(() => {});

    return Response.json({
      message: `成功更新 ${results.length} 项配置`,
      updated: results.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "请求格式错误" }, { status: 400 });
    }
    console.error("更新系统配置失败:", error);
    return Response.json({ error: "更新系统配置失败" }, { status: 500 });
  }
});
