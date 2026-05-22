import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidatePattern } from "@/lib/redis";

const VALID_TYPES = ["single", "multiple", "truefalse", "fillblank", "cloze"];
const MAX_QUESTIONS = 500;

async function parseJsonFile(content: string) {
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
  if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
  throw new Error("文件格式不正确，请使用 JSON 数组格式");
}

async function parseWordDocx(buffer: Buffer) {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parseExcelXlsx(buffer: Buffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel 文件没有工作表");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  if (rows.length < 2) throw new Error("Excel 文件至少需要标题行和一行数据");

  const header = rows[0].map((h: any) => String(h || "").trim().toLowerCase());

  // Auto-detect column mapping
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

  if (colMap.content === undefined || colMap.answer === undefined) {
      throw new Error(
        "Excel 表头需要包含【题目】和【答案】列。推荐格式: 类型 | 题目 | 选项 | 答案 | 解析"
      );
  }

  const questions: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const content = String(row[colMap.content] || "").trim();
    if (!content) continue;

    const type = colMap.type !== undefined
      ? String(row[colMap.type] || "single").trim()
      : "single";

    const answer = String(row[colMap.answer] || "").trim();
    const analysis = colMap.analysis !== undefined
      ? String(row[colMap.analysis] || "").trim()
      : "";

    let options: { key: string; value: string }[] = [];
    if (colMap.options !== undefined && row[colMap.options]) {
      const raw = String(row[colMap.options]).trim();
      // Support "A.xxx;B.yyy" or "A:xxx|B:yyy" or "A、xxx，B、yyy"
      const parts = raw.split(/[;；|｜\n]+/).filter(Boolean);
      if (parts.length >= 2) {
        options = parts.map((part) => {
          const match = part.match(/^([A-Z])[.、:：]\s*(.+)/);
          if (match) {
            return { key: match[1], value: match[2].trim() };
          }
          return { key: String.fromCharCode(65 + parts.indexOf(part)), value: part.trim() };
        });
      }
    }

    questions.push({
      type: VALID_TYPES.includes(type) ? type : "single",
      content,
      options,
      answer,
      analysis,
      image: colMap.image !== undefined ? String(row[colMap.image] || "").trim() || undefined : undefined,
      sortOrder: i - 1,
    });
  }

  return questions;
}

function extractQuestionsFromText(text: string): any[] {
  const questions: any[] = [];
  const lines = text.split(/\n\s*\n/).filter(Boolean);
  // Also split by numbered patterns
  const allBlocks: string[] = [];
  for (const line of lines) {
    const sub = line.split(/(?=^\d+[.、)）]\s*)/m);
    allBlocks.push(...sub.filter(Boolean));
  }

  for (const block of allBlocks) {
    const trimmed = block.trim();
    if (trimmed.length < 10) continue;

    const q: any = { type: "single", content: trimmed, options: [], answer: "", analysis: "", sortOrder: 0 };

    // Try to extract options (A.xxx, B.yyy)
    const optionRegex = /([A-E])[.、:：]\s*(.+?)(?=\s*[A-E][.、:：]|\s*答案[：:]*|\s*解析[：:]*|\s*$)/g;
    const optionMatches = [...trimmed.matchAll(optionRegex)];

    if (optionMatches.length >= 2) {
      q.options = optionMatches.map((m) => ({ key: m[1], value: m[2].trim() }));
      // Remove options from content for cleaner display
      let contentPart = trimmed;
      for (const m of optionMatches) {
        contentPart = contentPart.replace(m[0], "");
      }
      q.content = contentPart.replace(/\n{2,}/g, "\n").trim();
    }

    // Try to extract answer
    const answerMatch = trimmed.match(/答案[：:]\s*(.+)/);
    if (answerMatch) {
      q.answer = answerMatch[1].trim();
      // Clean content
      q.content = q.content.replace(answerMatch[0], "").trim();
    }

    // Try to extract analysis
    const analysisMatch = trimmed.match(/解析[：:]\s*([\s\S]+)/);
    if (analysisMatch) {
      q.analysis = analysisMatch[1].trim();
      q.content = q.content.replace(analysisMatch[0], "").trim();
    }

    if (q.content.length >= 5) {
      questions.push(q);
    }
  }

  return questions;
}

function validateAndNormalize(rawQuestions: any[]): { questions: any[]; errors: string[] } {
  const parsedQuestions: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const rowErrors: string[] = [];

    const content = typeof q.content === "string" ? q.content.trim() : "";
    if (!content) rowErrors.push("缺少题目内容");

    const answer = typeof q.answer === "string" ? q.answer.trim() : "";
    if (!answer) rowErrors.push("缺少答案");

    const type = q.type || "single";
    if (!VALID_TYPES.includes(type)) rowErrors.push(`无效的题目类型: ${type}`);

    let options = q.options || [];
    if (typeof options === "string") {
      try { options = JSON.parse(options); } catch { options = []; }
    }
    if (!Array.isArray(options)) options = [];

    if (rowErrors.length > 0) {
      errors.push(`第 ${i + 1} 题: ${rowErrors.join(", ")}`);
      continue;
    }

    parsedQuestions.push({
      type,
      content,
      options: ["truefalse", "fillblank"].includes(type) ? [] : options,
      answer,
      analysis: (q.analysis || "").trim(),
      image: q.image || undefined,
      sortOrder: i,
    });
  }

  return { questions: parsedQuestions, errors };
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bankId = formData.get("bankId") as string | null;

    if (!file) {
      return Response.json({ error: "请上传文件" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const mimeType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawQuestions: any[];

    if (
      fileName.endsWith(".json") ||
      mimeType === "application/json"
    ) {
      const content = new TextDecoder().decode(arrayBuffer);
      try {
        rawQuestions = await parseJsonFile(content);
      } catch {
        return Response.json({ error: "JSON 文件格式不正确" }, { status: 400 });
      }
    } else if (
      fileName.endsWith(".docx") ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const text = await parseWordDocx(buffer);
      if (!text.trim()) {
        return Response.json({ error: "Word 文档内容为空" }, { status: 400 });
      }
      rawQuestions = extractQuestionsFromText(text);
      if (rawQuestions.length === 0) {
        return Response.json({
          error: "未能从 Word 文档中解析出题目，请确保格式为: 题目编号 + 题目内容 + 选项(A.B.C.D) + 答案 + 解析",
          rawText: text.slice(0, 500),
        }, { status: 400 });
      }
    } else if (
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel")
    ) {
      try {
        rawQuestions = await parseExcelXlsx(buffer);
      } catch (err: any) {
        return Response.json({ error: err.message || "Excel 文件解析失败" }, { status: 400 });
      }
    } else {
      return Response.json({
        error: "不支持的文件格式，请上传 JSON、Word (.docx) 或 Excel (.xlsx) 文件",
      }, { status: 400 });
    }

    if (rawQuestions.length === 0) {
      return Response.json({ error: "文件中没有找到题目" }, { status: 400 });
    }

    if (rawQuestions.length > MAX_QUESTIONS) {
      return Response.json({ error: `单次最多上传 ${MAX_QUESTIONS} 道题目` }, { status: 400 });
    }

    const { questions: parsedQuestions, errors } = validateAndNormalize(rawQuestions);

    if (parsedQuestions.length === 0) {
      return Response.json({
        error: "没有有效的题目可以导入",
        details: errors,
      }, { status: 400 });
    }

    if (bankId) {
      const bank = await prisma.questionBank.findUnique({
        where: { id: bankId },
        select: { id: true, uploaderId: true },
      });

      if (!bank) {
        return Response.json({ error: "题库不存在" }, { status: 404 });
      }

      if (bank.uploaderId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        return Response.json({ error: "无权向该题库添加题目" }, { status: 403 });
      }

      const created = await prisma.$transaction(
        parsedQuestions.map((q) =>
          prisma.question.create({
            data: {
              bankId,
              type: q.type,
              content: q.content,
              options: q.options || [],
              answer: q.answer,
              analysis: q.analysis,
              image: q.image || null,
              sortOrder: q.sortOrder,
            },
          })
        )
      );

      await invalidatePattern(`questions:*:${bankId}:*`);

      return Response.json({
        message: `成功导入 ${created.length} 道题目`,
        data: {
          imported: created.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    }

    return Response.json({
      message: `成功解析 ${parsedQuestions.length} 道题目`,
      data: {
        questions: parsedQuestions,
        total: parsedQuestions.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    console.error("上传题目文件失败:", error);
    return Response.json({ error: "上传失败，请稍后重试" }, { status: 500 });
  }
}
