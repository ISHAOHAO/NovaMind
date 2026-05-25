import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getSystemConfig } from "@/lib/config";
import { askAi } from "@/lib/ai";
import {
  checkUploadAnalyzeLimit,
  incrementUploadAnalyzeUsage,
  getUploadAnalyzeRemaining,
} from "@/lib/ai-usage";

const VALID_TYPES = ["single", "multiple", "truefalse", "fillblank", "cloze"];

interface ParsedStats {
  total: number;
  valid: number;
  errors: string[];
  typeDistribution: Record<string, number>;
  hasImages: number;
  totalOptions: number;
}

function analyzeQuestions(questions: any[]): ParsedStats {
  const stats: ParsedStats = {
    total: questions.length,
    valid: 0,
    errors: [],
    typeDistribution: {},
    hasImages: 0,
    totalOptions: 0,
  };

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const rowErrors: string[] = [];

    if (!q.content || !String(q.content).trim()) {
      rowErrors.push("缺少题目内容");
    }
    if (!q.answer || !String(q.answer).trim()) {
      rowErrors.push("缺少答案");
    }

    const type = q.type || "single";
    if (!VALID_TYPES.includes(type)) {
      rowErrors.push(`未知题目类型: ${type}`);
    }

    stats.typeDistribution[type] = (stats.typeDistribution[type] || 0) + 1;
    if (q.image) stats.hasImages++;

    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length > 0) stats.totalOptions++;

    if ((type === "single" || type === "multiple") && options.length === 0) {
      rowErrors.push("选择题缺少选项");
    }

    if (rowErrors.length === 0) {
      stats.valid++;
    } else {
      stats.errors.push(`第${i + 1}题: ${rowErrors.join("; ")}`);
    }
  }

  return stats;
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const aiEnabled = await getSystemConfig("ai_enabled");
    if (aiEnabled !== "true") {
      return Response.json({ error: "AI 功能未启用" }, { status: 403 });
    }

    const { allowed, used, limit, message } = await checkUploadAnalyzeLimit(user.userId);
    if (!allowed) {
      return Response.json({ error: message, used, limit }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const questionsJson = formData.get("questions") as string | null;

    let questions: any[] = [];
    let fileFormat = "未知";

    if (file) {
      const fileName = file.name.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      if (fileName.endsWith(".json")) {
        fileFormat = "JSON";
        try {
          const parsed = JSON.parse(new TextDecoder().decode(buffer));
          questions = Array.isArray(parsed)
            ? parsed
            : parsed.questions || parsed.data || [];
        } catch {
          return Response.json({ error: "JSON 文件格式不正确" }, { status: 400 });
        }
      } else if (fileName.endsWith(".docx")) {
        fileFormat = "Word (.docx)";
        const mammoth = (await import("mammoth")).default;
        const result = await mammoth.extractRawText({ buffer });
        const rawText = result.value;
        if (rawText.trim()) {
          questions = extractQuestionsFromText(rawText);
        }
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        fileFormat = "Excel";
        try {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          questions = rows.slice(1).map((row, i) => ({
            type: String(row[0] || "single").trim(),
            content: String(row[1] || "").trim(),
            options: [],
            answer: String(row[3] || "").trim(),
            analysis: String(row[4] || "").trim(),
          })).filter((q: any) => q.content);
        } catch {
          return Response.json({ error: "Excel 文件解析失败" }, { status: 400 });
        }
      } else {
        return Response.json({ error: "不支持的文件格式" }, { status: 400 });
      }
    } else if (questionsJson) {
      try {
        questions = JSON.parse(questionsJson);
        fileFormat = "手动录入";
      } catch {
        return Response.json({ error: "题目数据格式不正确" }, { status: 400 });
      }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return Response.json({ error: "没有找到题目数据" }, { status: 400 });
    }

    const stats = analyzeQuestions(questions);

    const questionsPreview = questions.slice(0, 5).map((q: any, i: number) => {
      const options = Array.isArray(q.options) ? q.options : [];
      return `题目${i + 1}: ${q.content || "(空)"}
类型: ${q.type || "single"}
${options.length > 0 ? "选项: " + options.map((o: any) => `${o.key}: ${o.value}`).join(" | ") : "无选项"}
答案: ${q.answer || "(空)"}
解析: ${q.analysis || "(无)"}`;
    }).join("\n\n---\n\n");

    const typeDistStr = Object.entries(stats.typeDistribution)
      .map(([t, c]) => `${t}: ${c}题`)
      .join(", ");

    const prompt = `你是一个题库文件上传分析助手。请分析以下用户上传的题库文件，帮助用户判断是否可以正常导入。

【文件信息】
- 文件格式: ${fileFormat}
- 题目总数: ${stats.total}
- 有效题目: ${stats.valid}
- 题目类型分布: ${typeDistStr}
- 包含图片的题目: ${stats.hasImages}题
${stats.errors.length > 0 ? `- 解析错误/警告:\n${stats.errors.slice(0, 10).map((e) => "  - " + e).join("\n")}${stats.errors.length > 10 ? `\n  ...共${stats.errors.length}条` : ""}` : "- 无解析错误"}

【题目预览（前${Math.min(5, questions.length)}道）】
${questionsPreview}

请从以下角度进行分析，并以 JSON 格式返回：

1. **文件格式**: 文件结构是否符合模板要求？是否能够被系统正确识别？
2. **题目质量**: 题目内容、选项、答案是否完整？是否有明显的格式问题？
3. **导入建议**: 哪些题目可以直接导入？哪些需要修改？给出优先级排序。
4. **总体评估**: 该题库的整体质量和可用性评分（1-10）。

返回严格的 JSON 格式（不要用 markdown 代码块包裹）:
{
  "formatCheck": { "passed": true/false, "message": "格式检查结果" },
  "qualityCheck": { "passed": true/false, "score": 8, "message": "质量评估结果" },
  "issues": [
    { "severity": "error/warning/info", "title": "问题标题", "detail": "问题详情", "affectedQuestions": "1,3,5" }
  ],
  "suggestions": ["建议1", "建议2"],
  "summary": "总体评价（一段中文）"
}`;

    const result = await askAi(
      prompt,
      "你是一个专业的题库分析助手，请严格返回 JSON 格式。"
    );

    let analysis: any = null;
    try {
      let content = result.content || "";
      content = content
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      analysis = JSON.parse(content);
    } catch {
      analysis = { raw: result.content, parseError: true };
    }

    await incrementUploadAnalyzeUsage(user.userId);
    const remaining = await getUploadAnalyzeRemaining(user.userId);

    return Response.json({
      success: true,
      data: {
        stats: {
          total: stats.total,
          valid: stats.valid,
          typeDistribution: stats.typeDistribution,
          hasImages: stats.hasImages,
          errors: stats.errors.slice(0, 20),
        },
        analysis,
        usage: remaining,
      },
    });
  } catch (error) {
    console.error("[AI Analyze Upload] Error:", error);
    return Response.json({ error: "上传分析失败，请稍后重试" }, { status: 500 });
  }
}

// Simplified local extractor (mirrors upload route logic)
function extractQuestionsFromText(text: string): any[] {
  const questions: any[] = [];
  const blocks = text.split(/\n\n+/).filter((b) => b.trim().length > 5);

  for (const block of blocks) {
    const trimmed = block.trim();
    const q: any = {
      type: "single",
      content: trimmed,
      options: [],
      answer: "",
      analysis: "",
    };

    const optRegex = /([A-E])[.、:：]\s*(.+?)(?=\s*[A-E][.、:：]|\s*答案|\s*解析|$)/g;
    const opts = [...trimmed.matchAll(optRegex)];
    if (opts.length >= 2) {
      q.options = opts.map((m) => ({ key: m[1], value: m[2].trim() }));
      q.content = trimmed.replace(optRegex, "").replace(/\n{2,}/g, "\n").trim();
    }

    const ansMatch = trimmed.match(/答案[:：]\s*(.+)/);
    if (ansMatch) {
      q.answer = ansMatch[1].trim();
      q.content = q.content.replace(ansMatch[0], "").trim();
    }

    const anaMatch = trimmed.match(/解析[:：]\s*([\s\S]+)/);
    if (anaMatch) {
      q.analysis = anaMatch[1].trim();
      q.content = q.content.replace(anaMatch[0], "").trim();
    }

    if (q.content.length >= 5) questions.push(q);
  }

  return questions;
}
