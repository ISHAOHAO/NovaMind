import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDifficultyLabel } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "md";
    const noteIdsParam = searchParams.get("noteIds");

    const where: any = { userId: user.userId };

    if (noteIdsParam) {
      const ids = noteIdsParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        where.id = { in: ids };
      }
    }

    const notes = await prisma.note.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        question: {
          select: {
            content: true,
            type: true,
            answer: true,
            analysis: true,
            bank: {
              select: {
                title: true,
                category: true,
                difficulty: true,
              },
            },
          },
        },
      },
    });

    const now = new Date().toLocaleString("zh-CN");
    let markdown = `# NovaMind 笔记导出\n\n导出时间：${now}\n导出数量：${notes.length} 条\n\n---\n\n`;

    notes.forEach((note, index) => {
      const importanceStars = "★".repeat(note.importance) + "☆".repeat(5 - note.importance);
      const question = note.question;
      const bank = question.bank;

      markdown += `## ${index + 1}. ${question.content}\n\n`;
      markdown += `- **题型**：${question.type}\n`;
      markdown += `- **答案**：${question.answer}\n`;
      markdown += `- **重要性**：${importanceStars}\n`;
      if (bank) {
        markdown += `- **题库**：${bank.title}\n`;
        markdown += `- **分类**：${bank.category}\n`;
        markdown += `- **难度**：${getDifficultyLabel(bank.difficulty)}\n`;
      }
      if (question.analysis) {
        markdown += `- **解析**：${question.analysis}\n`;
      }
      if (note.isAiGenerated) {
        markdown += `- **标签**：AI 生成\n`;
      }
      markdown += `\n### 笔记内容\n\n${note.content}\n\n`;
      markdown += `---\n\n`;
    });

    const fileName = `notes-export.md`;
    const encodedFileName = encodeURIComponent(fileName);

    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodedFileName}"`,
      },
    });
  } catch (error: any) {
    console.error("导出笔记失败:", error);
    return Response.json({ error: "导出笔记失败，请稍后重试" }, { status: 500 });
  }
}
