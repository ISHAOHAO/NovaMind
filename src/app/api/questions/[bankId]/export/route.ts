import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

type RouteContext = { params: Promise<{ bankId: string }> };

const MAX_EXPORT_QUESTIONS = 5000;

interface ExportOption {
  key: string;
  value: string;
}

/**
 * 题库导出：仅上传者或管理员可导出。
 * 返回的 JSON 与上传页模板（/api/questions/template JSON 格式）兼容——
 * 上传解析只读取 questions 数组，其元素字段为 type/content/options/answer/analysis(/image)。
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { bankId } = await context.params;

    const bank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      include: {
        questions: {
          orderBy: { sortOrder: "asc" },
          select: {
            type: true,
            content: true,
            options: true,
            answer: true,
            analysis: true,
            image: true,
          },
          take: MAX_EXPORT_QUESTIONS,
        },
      },
    });

    if (!bank) {
      return Response.json({ error: "题库不存在" }, { status: 404 });
    }

    if (
      bank.uploaderId !== user.userId &&
      user.role !== "ADMIN" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return Response.json(
        { error: "仅题库上传者或管理员可导出该题库" },
        { status: 403 }
      );
    }

    const payload = {
      title: bank.title,
      description: bank.description || "",
      category: bank.category,
      tags: bank.tags,
      difficulty: bank.difficulty,
      questions: bank.questions.map((q) => ({
        type: q.type,
        content: q.content,
        options: q.options as unknown as ExportOption[],
        answer: q.answer,
        analysis: q.analysis || "",
        ...(q.image ? { image: q.image } : {}),
      })),
    };

    // 文件名含题库标题：ASCII 回退名 + RFC 5987 编码的 UTF-8 名
    const asciiName = bank.title
      .replace(/[\x00-\x1f\x22\x5c/]+/g, "")
      .replace(/[^A-Za-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const fallbackName = asciiName || "question-bank";
    const utf8Name = encodeURIComponent(
      `NovaMind-${bank.title.replace(/[\x00-\x1f\x22\x5c/]+/g, "").slice(0, 60)}.json`
    );

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fallbackName}.json"; filename*=UTF-8''${utf8Name}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("导出题库失败:", error);
    return Response.json({ error: "导出题库失败，请稍后重试" }, { status: 500 });
  }
}
