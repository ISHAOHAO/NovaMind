import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { questionBankSchema } from "@/lib/validations";
import { getSystemConfig } from "@/lib/config";
import { formatDate, getDifficultyLabel } from "@/lib/utils";
import { invalidatePattern, getFromCache, setToCache } from "@/lib/redis";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const difficulty = searchParams.get("difficulty");
    const tagsParam = searchParams.get("tags") || "";
    const sort = searchParams.get("sort") || "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const cacheKey = `questions:list:${search}:${category}:${difficulty}:${tagsParam}:${sort}:${page}:${limit}`;
    const cached = await getFromCache<any>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const where: any = {
      status: "APPROVED",
      isPublic: true,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (difficulty) {
      where.difficulty = parseInt(difficulty, 10);
    }

    if (tagsParam) {
      const tagList = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        where.tags = { hasSome: tagList };
      }
    }

    const orderBy: any =
      sort === "popular"
        ? { questions: { _count: "desc" } }
        : { createdAt: "desc" };

    const [banks, total] = await Promise.all([
      prisma.questionBank.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          uploader: { select: { id: true, name: true, avatar: true } },
          _count: { select: { questions: true } },
        },
      }),
      prisma.questionBank.count({ where }),
    ]);

    const result = banks.map((bank) => ({
      id: bank.id,
      title: bank.title,
      description: bank.description,
      source: bank.source,
      category: bank.category,
      tags: bank.tags,
      difficulty: bank.difficulty,
      difficultyLabel: getDifficultyLabel(bank.difficulty),
      questionCount: bank._count.questions,
      uploader: bank.uploader,
      createdAt: formatDate(bank.createdAt),
      updatedAt: formatDate(bank.updatedAt),
    }));

    const response = {
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await setToCache(cacheKey, response, 120);

    return Response.json(response);
  } catch (error: any) {
    console.error("获取题库列表失败:", error);
    return Response.json({ error: "获取题库列表失败，请稍后重试" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();

    const parsed = questionBankSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({
        error: "输入数据校验失败",
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const reviewRequired = await getSystemConfig("question_review_required", "false");
    const initialStatus = reviewRequired === "true" ? "PENDING" : "APPROVED";

    const bank = await prisma.questionBank.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        source: parsed.data.source,
        category: parsed.data.category,
        tags: parsed.data.tags,
        difficulty: parsed.data.difficulty,
        isPublic: parsed.data.isPublic,
        uploaderId: user.userId,
        status: initialStatus,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: "QUESTION_BANK_CREATE",
        details: JSON.stringify({ bankId: bank.id, title: bank.title }),
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    await invalidatePattern("questions:list:*");

    return Response.json({
      data: {
        id: bank.id,
        title: bank.title,
        status: bank.status,
        createdAt: formatDate(bank.createdAt),
      },
      message: initialStatus === "PENDING" ? "题库已提交，待审核通过后公开显示" : "题库创建成功",
    }, { status: 201 });
  } catch (error: any) {
    console.error("创建题库失败:", error);
    return Response.json({ error: "创建题库失败，请稍后重试" }, { status: 500 });
  }
}
