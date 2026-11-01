import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { questionSchema } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { invalidatePattern, getFromCache, setToCache } from "@/lib/redis";

type RouteContext = { params: Promise<{ bankId: string }> };

// 从完整列表响应中切分出分页响应（缓存始终存完整列表，切分在命中后进行）
function slicePageResponse(
  full: { data: any[]; total: number },
  offset: number,
  limit: number
) {
  const page = full.data.slice(offset, offset + limit);
  return Response.json({
    data: page,
    total: full.total,
    offset,
    limit,
    hasMore: offset + limit < full.total,
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { bankId } = await context.params;

    // 题目列表包含答案与解析，必须登录且有权访问所属题库
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const bank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      select: { id: true, isPublic: true, status: true, uploaderId: true },
    });
    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    const isPublicBank = bank.isPublic && bank.status === "APPROVED";
    if (
      !isPublicBank &&
      bank.uploaderId !== user.userId &&
      user.role !== "ADMIN" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return Response.json({ error: "您没有权限查看该题库的题目" }, { status: 403 });
    }

    // 仅公开且已过审的题库内容对所有用户一致，可安全共享缓存
    const { searchParams } = new URL(req.url);
    const fields = searchParams.get("fields");
    const offsetParam = searchParams.get("offset");
    const limitParam = searchParams.get("limit");

    // 轻量模式：仅返回有序 ID 列表（供前端懒加载调度用）
    if (fields === "ids") {
      const idsCacheKey = `questions:ids:${bankId}:list`;
      if (isPublicBank) {
        const cachedIds = await getFromCache<string[]>(idsCacheKey);
        if (cachedIds) {
          return Response.json({ data: cachedIds, total: cachedIds.length });
        }
      }

      const ids = await prisma.question.findMany({
        where: { bankId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      const idList = ids.map((q) => q.id);
      const response = { data: idList, total: idList.length };
      if (isPublicBank) {
        await setToCache(idsCacheKey, response, 120);
      }
      return Response.json(response);
    }

    const paginated = offsetParam !== null || limitParam !== null;
    const offset = Math.max(0, parseInt(offsetParam || "0", 10) || 0);
    const limit = Math.min(300, Math.max(1, parseInt(limitParam || "200", 10) || 200));

    const cacheKey = `questions:detail:${bankId}:questions`;
    if (isPublicBank) {
      const cached = await getFromCache<any>(cacheKey);
      if (cached) {
        return paginated
          ? slicePageResponse(cached, offset, limit)
          : Response.json(cached);
      }
    }

    const questions = await prisma.question.findMany({
      where: { bankId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        type: true,
        content: true,
        options: true,
        answer: true,
        analysis: true,
        image: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const result = questions.map((q) => ({
      ...q,
      options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
      createdAt: formatDate(q.createdAt),
      updatedAt: formatDate(q.updatedAt),
    }));

    const response = {
      data: result,
      total: result.length,
    };

    if (isPublicBank) {
      await setToCache(cacheKey, response, 120);
    }

    if (paginated) {
      return slicePageResponse(response, offset, limit);
    }

    return Response.json(response);
  } catch (error: any) {
    console.error("获取题目列表失败:", error);
    return Response.json({ error: "获取题目列表失败，请稍后重试" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { bankId } = await context.params;

    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    if (bank.uploaderId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return Response.json({ error: "您没有权限向该题库添加题目" }, { status: 403 });
    }

    const body = await req.json();

    const questions = Array.isArray(body) ? body : [body];

    if (questions.length === 0) {
      return Response.json({ error: "请至少提供一道题目" }, { status: 400 });
    }

    // 单请求上限：前端分批提交（每批 500），此处防御异常超大载荷
    const MAX_PER_REQUEST = 2000;
    if (questions.length > MAX_PER_REQUEST) {
      return Response.json(
        { error: `单次最多添加 ${MAX_PER_REQUEST} 道题目，请分批提交` },
        { status: 400 }
      );
    }

    const errors: { index: number; errors: any }[] = [];
    const validQuestions: typeof questionSchema._type[] = [];

    for (let i = 0; i < questions.length; i++) {
      const parsed = questionSchema.safeParse(questions[i]);
      if (!parsed.success) {
        errors.push({
          index: i,
          errors: parsed.error.flatten().fieldErrors,
        });
      } else {
        validQuestions.push(parsed.data);
      }
    }

    if (errors.length > 0) {
      return Response.json({
        error: "部分题目数据校验失败",
        details: errors,
      }, { status: 400 });
    }

    // 分块批量写入，保持事务原子性
    const IMPORT_CHUNK_SIZE = 500;
    let imported = 0;
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < validQuestions.length; i += IMPORT_CHUNK_SIZE) {
        const chunk = validQuestions.slice(i, i + IMPORT_CHUNK_SIZE);
        const result = await tx.question.createMany({
          data: chunk.map((q) => ({
            bankId,
            type: q.type,
            content: q.content,
            options: q.options || [],
            answer: q.answer,
            analysis: q.analysis,
            image: q.image || null,
            sortOrder: q.sortOrder,
          })),
        });
        imported += result.count;
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "QUESTIONS_ADD",
        details: JSON.stringify({ bankId, count: imported }),
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    await invalidatePattern(`questions:*:${bankId}:*`);

    return Response.json({
      data: { imported },
      message: `成功添加 ${imported} 道题目`,
    }, { status: 201 });
  } catch (error: any) {
    console.error("添加题目失败:", error);
    return Response.json({ error: "添加题目失败，请稍后重试" }, { status: 500 });
  }
}
