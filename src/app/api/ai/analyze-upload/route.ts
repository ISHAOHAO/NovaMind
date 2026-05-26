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

    let type = q.type || "single";
    const typeLower = String(type).toLowerCase().trim();
    const typeLabelMap: Record<string, string> = {
      "单选题": "single", "单选": "single",
      "多选题": "multiple", "多选": "multiple",
      "判断题": "truefalse", "判断": "truefalse",
      "填空题": "fillblank", "填空": "fillblank",
      "完形填空": "cloze", "cloze": "cloze",
    };
    type = typeLabelMap[typeLower] || typeLower;
    if (!VALID_TYPES.includes(type)) {
      // Try to detect type based on content
      const content = String(q.content || "").trim();
      const answer = String(q.answer || "").trim();
      if (/__\d+__/.test(content)) {
        type = "cloze";
      } else if (/\)/.test(content)) {
        type = "fillblank";
      } else {
        type = "single";
      }
    }

    stats.typeDistribution[type] = (stats.typeDistribution[type] || 0) + 1;
    if (q.image) stats.hasImages++;

    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length > 0) stats.totalOptions++;

    if ((type === "single" || type === "multiple" || type === "cloze") && options.length === 0) {
      rowErrors.push(`${type} 类型题目缺少选项`);
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
      } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
        if (fileName.endsWith(".doc") && !fileName.endsWith(".docx")) {
          fileFormat = "Word (.doc)";
        } else {
          fileFormat = "Word (.docx)";
        }
        try {
          const mammoth = (await import("mammoth")).default;
          const result = await mammoth.extractRawText({ buffer });
          const rawText = result.value;
          if (rawText.trim()) {
            questions = extractQuestionsFromText(rawText);
          }
        } catch {
          if (fileName.endsWith(".doc") && !fileName.endsWith(".docx")) {
            // Fallback for old .doc: try to extract text from binary
            const extracted = extractTextFromDocBinary(buffer);
            if (extracted.trim().length >= 10) {
              questions = extractQuestionsFromText(extracted);
            }
          }
        }
        if (questions.length === 0 && fileName.endsWith(".doc") && !fileName.endsWith(".docx")) {
          return Response.json({
            error: "无法解析旧版 .doc 文件，请使用 Microsoft Word 将文件另存为 .docx 格式后再上传",
          }, { status: 400 });
        }
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        fileFormat = "Excel";
        try {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

          if (rows.length < 2) {
            return Response.json({ error: "Excel 文件至少需要标题行和一行数据" }, { status: 400 });
          }

          const header = rows[0].map((h: any) => String(h || "").trim().toLowerCase());
          const colMap: Record<string, number> = {};
          for (let i = 0; i < header.length; i++) {
            const h = header[i];
            if (h.includes("类型") || h === "type") colMap.type = i;
            else if (h.includes("题目") || h.includes("内容") || h === "content" || h === "question") colMap.content = i;
            else if (h.includes("选项") || h === "options") colMap.options = i;
            else if (h.includes("答案") || h === "answer") colMap.answer = i;
            else if (h.includes("解析") || h === "analysis") colMap.analysis = i;
            else if (h.includes("图片") || h === "image") colMap.image = i;
          }

          const typeLabelMap: Record<string, string> = {
            "单选题": "single", "单选": "single",
            "多选题": "multiple", "多选": "multiple",
            "判断题": "truefalse", "判断": "truefalse",
            "填空题": "fillblank", "填空": "fillblank",
            "完形填空": "cloze", "cloze": "cloze",
          };

          questions = rows.slice(1).filter((row: any[]) => row && row.length > 0).map((row: any[], i: number) => {
            const rawType = String(row[colMap.type !== undefined ? colMap.type : 0] || "single").trim();
            const mappedType = typeLabelMap[rawType] || rawType;
            const content = String(row[colMap.content !== undefined ? colMap.content : 1] || "").trim();

            let options: any[] = [];
            if (colMap.options !== undefined && row[colMap.options]) {
              const raw = String(row[colMap.options]).trim();
              if (mappedType === "cloze" || rawType === "完形填空") {
                const blankParts = raw.split(/[;；\n]+/).filter(Boolean);
                options = blankParts.map((part, j) => {
                  const match = part.trim().match(/^(\d+)\s*[.、]\s*(.+)$/);
                  if (match) return { key: match[1], value: match[2].trim() };
                  return { key: String(j + 1), value: part.trim() };
                });
              } else {
                const parts = raw.split(/[;；\n]+/).filter(Boolean);
                if (parts.length >= 2) {
                  options = parts.map((part) => {
                    const match = part.trim().match(/^([A-E])[.、:：]\s*(.+)/);
                    if (match) return { key: match[1], value: match[2].trim() };
                    return { key: String.fromCharCode(65 + parts.indexOf(part)), value: part.trim() };
                  });
                }
              }
            }

            const answer = String(row[colMap.answer !== undefined ? colMap.answer : 3] || "").trim();
            const analysis = colMap.analysis !== undefined
              ? String(row[colMap.analysis] || "").trim()
              : "";

            return {
              type: mappedType,
              content,
              options,
              answer,
              analysis,
            };
          }).filter((q: any) => q.content);
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
      const typeLower = String(q.type || "").toLowerCase().trim();
      const typeLabelMap: Record<string, string> = {
        "single": "单选题", "multiple": "多选题", "truefalse": "判断题",
        "fillblank": "填空题", "cloze": "完形填空",
      };
      const typeLabel = typeLabelMap[typeLower] || q.type || "single";

      let optionsStr = "";
      if (typeLower === "cloze" && options.length > 0) {
        optionsStr = "空白选项:\n" + options.map((o: any) => `  空白${o.key}: ${o.value}`).join("\n");
      } else if (options.length > 0) {
        optionsStr = "选项: " + options.map((o: any) => `${o.key}: ${o.value}`).join(" | ");
      } else {
        optionsStr = "无选项";
      }

      return `题目${i + 1}: ${q.content || "(空)"}
类型: ${typeLabel}
${optionsStr}
答案: ${q.answer || "(空)"}
解析: ${q.analysis || "(无)"}`;
    }).join("\n\n---\n\n");

    const typeLabels: Record<string, string> = {
      single: "单选题", multiple: "多选题", truefalse: "判断题",
      fillblank: "填空题", cloze: "完形填空",
    };

    const typeDistStr = Object.entries(stats.typeDistribution)
      .map(([t, c]) => `${typeLabels[t] || t}: ${c}题`)
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

【支持的题目类型说明】
- single: 单选题（只有一个正确答案，答案格式如 "A"）
- multiple: 多选题（多个正确答案，答案格式如 "A,B,D"）
- truefalse: 判断题（答案格式 "true" 或 "false"）
- fillblank: 填空题（答案格式为文本，如 "background-color"）
- cloze: 完形填空（文章中有多个空白，每个空白有各自选项，答案格式如 "B,C,A"，用逗号分隔每个空的答案）

请从以下角度进行分析，并以 JSON 格式返回：

1. **文件格式**: 
   - 文件结构是否符合模板要求？题目类型是否正确识别？
   - 完形填空类型的题目是否正确填写了空白选项？
   - 是否有明显的格式错误导致无法导入？

2. **题目质量**: 
   - 题目内容、选项、答案是否完整？
   - 选择题的答案是否在选项中存在？
   - 完形填空的答案格式是否正确（多个答案用逗号分隔）？

3. **导入建议**: 
   - 哪些题目可以直接导入？
   - 哪些需要修改？给出优先级排序和具体修改建议。

4. **总体评估**: 
   - 该题库的整体质量和可用性评分（1-10）。
   - 如果质量低于6分，建议用户重点检查哪些方面。

返回严格的 JSON 格式（不要用 markdown 代码块包裹）:
{
  "formatCheck": { "passed": true/false, "message": "格式检查结果" },
  "qualityCheck": { "passed": true/false, "score": 8, "message": "质量评估结果" },
  "issues": [
    { "severity": "error/warning/info", "title": "问题标题", "detail": "问题详情", "affectedQuestions": "1,3,5" }
  ],
  "suggestions": ["建议1", "建议2"],
  "summary": "总体评价（一段中文，包含评分理由）"
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

// Fallback text extractor for old binary .doc files
function extractTextFromDocBinary(buffer: Buffer): string {
  let text = "";

  const utf16Parts: string[] = [];
  let runStart = -1;
  for (let i = 0; i < buffer.length - 1; i += 2) {
    const code = buffer.readUInt16LE(i);
    if (
      (code >= 0x20 && code <= 0x7E) ||
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3000 && code <= 0x303F) ||
      (code >= 0xFF00 && code <= 0xFFEF) ||
      (code >= 0x2000 && code <= 0x206F) ||
      code === 0x0D || code === 0x0A
    ) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1 && i - runStart >= 4) {
        utf16Parts.push(buffer.slice(runStart, i).toString("utf16le"));
      }
      runStart = -1;
    }
  }
  if (runStart !== -1 && buffer.length - runStart >= 4) {
    utf16Parts.push(buffer.slice(runStart).toString("utf16le"));
  }

  if (utf16Parts.length > 0) {
    text = utf16Parts.join("\n");
  }

  if (text.length < 20) {
    const latin1 = buffer.toString("latin1");
    const lines = latin1.split(/[\r\n]+/).filter((line) => {
      const cleaned = line.replace(/[^\x20-\x7E\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g, "");
      return cleaned.length >= 10;
    });
    text = lines.join("\n");
  }

  text = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
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
