import { NextRequest } from "next/server";
import { requireAdmin, TokenPayload } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFromCache, setToCache, deleteFromCache } from "@/lib/redis";

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "";

    const cacheKey = `admin:review-templates:${category}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const where: any = {};
    if (category) {
      where.category = category;
    }

    const templates = await prisma.reviewTemplate.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    const data = { templates };
    await setToCache(cacheKey, data, 120);

    return Response.json(data);
  } catch (error) {
    console.error("获取审核模板失败:", error);
    return Response.json({ error: "获取审核模板失败" }, { status: 500 });
  }
});

export const POST = requireAdmin(async (req: NextRequest) => {
  try {
    const currentUser = (req as any).user as TokenPayload;
    const body = await req.json();
    const { name, content, category, isDefault } = body;

    if (!name || !content) {
      return Response.json({ error: "名称和内容不能为空" }, { status: 400 });
    }

    if (isDefault) {
      await prisma.reviewTemplate.updateMany({
        where: { category: category || "", isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.reviewTemplate.create({
      data: {
        name,
        content,
        category: category || "",
        isDefault: isDefault || false,
        createdBy: currentUser.userId,
      },
    });

    deleteFromCache(`admin:review-templates:${category || ""}`).catch(() => {});
    deleteFromCache("admin:review-templates:").catch(() => {});

    return Response.json({ template, message: "模板创建成功" });
  } catch (error) {
    console.error("创建审核模板失败:", error);
    return Response.json({ error: "创建审核模板失败" }, { status: 500 });
  }
});

export const PUT = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "缺少模板ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, content, category, isDefault } = body;

    if (isDefault) {
      const existing = await prisma.reviewTemplate.findUnique({ where: { id } });
      if (existing) {
        await prisma.reviewTemplate.updateMany({
          where: { category: category || existing.category, isDefault: true },
          data: { isDefault: false },
        });
      }
    }

    const template = await prisma.reviewTemplate.update({
      where: { id },
      data: {
        name,
        content,
        category,
        isDefault,
      },
    });

    deleteFromCache(`admin:review-templates:${category || ""}`).catch(() => {});
    deleteFromCache("admin:review-templates:").catch(() => {});

    return Response.json({ template, message: "模板更新成功" });
  } catch (error) {
    console.error("更新审核模板失败:", error);
    return Response.json({ error: "更新审核模板失败" }, { status: 500 });
  }
});

export const DELETE = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "缺少模板ID" }, { status: 400 });
    }

    const existing = await prisma.reviewTemplate.findUnique({ where: { id } });
    await prisma.reviewTemplate.delete({ where: { id } });

    deleteFromCache(`admin:review-templates:${existing?.category || ""}`).catch(() => {});
    deleteFromCache("admin:review-templates:").catch(() => {});

    return Response.json({ message: "模板已删除" });
  } catch (error) {
    console.error("删除审核模板失败:", error);
    return Response.json({ error: "删除审核模板失败" }, { status: 500 });
  }
});
