import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const status = searchParams.get("status") || "";

    const where: any = { userId: user.userId };
    if (status && ["DRAFT", "IN_PROGRESS", "COMPLETED", "ABANDONED"].includes(status)) {
      where.status = status;
    }

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { questions: true } },
        },
      }),
      prisma.exam.count({ where }),
    ]);

    const result = exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      difficulty: exam.difficulty,
      totalQuestions: exam.totalQuestions,
      correctCount: exam.correctCount,
      score: exam.score,
      status: exam.status,
      startedAt: exam.startedAt ? formatDate(exam.startedAt) : null,
      completedAt: exam.completedAt ? formatDate(exam.completedAt) : null,
      questionCount: exam._count.questions,
      createdAt: formatDate(exam.createdAt),
      updatedAt: formatDate(exam.updatedAt),
    }));

    return Response.json({
      exams: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("获取考试列表失败:", error);
    return Response.json({ error: "获取考试列表失败，请稍后重试" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, bankIds, questionCount, durationMinutes, difficulty } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return Response.json({ error: "请填写考试标题" }, { status: 400 });
    }

    if (!bankIds || !Array.isArray(bankIds) || bankIds.length === 0) {
      return Response.json({ error: "请选择至少一个题库" }, { status: 400 });
    }

    const qCount = parseInt(String(questionCount), 10);
    if (!qCount || qCount < 1 || qCount > 200) {
      return Response.json({ error: "题目数量应在 1 到 200 之间" }, { status: 400 });
    }

    const dur = parseInt(String(durationMinutes), 10);
    if (!dur || dur < 1 || dur > 480) {
      return Response.json({ error: "考试时长应在 1 到 480 分钟之间" }, { status: 400 });
    }

    const diff = difficulty ? parseInt(String(difficulty), 10) : undefined;
    if (diff !== undefined && (diff < 1 || diff > 5)) {
      return Response.json({ error: "难度等级应在 1 到 5 之间" }, { status: 400 });
    }

    const questionWhere: any = { bankId: { in: bankIds } };
    if (diff !== undefined) {
      questionWhere.bank = { difficulty: diff };
    }

    const totalAvailable = await prisma.question.count({ where: questionWhere });

    if (totalAvailable === 0) {
      return Response.json({ error: "所选题库中没有符合条件的题目" }, { status: 400 });
    }

    const actualCount = Math.min(qCount, totalAvailable);

    const allQuestionIds = await prisma.question.findMany({
      where: questionWhere,
      select: { id: true },
    });

    const shuffled = allQuestionIds.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, actualCount);

    const exam = await prisma.exam.create({
      data: {
        title: title.trim(),
        description: description || null,
        userId: user.userId,
        durationMinutes: dur,
        difficulty: diff || 3,
        totalQuestions: actualCount,
        status: "DRAFT",
        questions: {
          create: selected.map((q, idx) => ({
            questionId: q.id,
            sortOrder: idx,
          })),
        },
        settings: { bankIds, originalCount: qCount },
      },
      include: {
        _count: { select: { questions: true } },
      },
    });

    return Response.json(
      {
        exam: {
          id: exam.id,
          title: exam.title,
          status: exam.status,
          questionCount: exam._count.questions,
          createdAt: formatDate(exam.createdAt),
        },
        message: "考试创建成功",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("创建考试失败:", error);
    return Response.json({ error: "创建考试失败，请稍后重试" }, { status: 500 });
  }
}
