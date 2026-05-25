import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidatePattern } from "@/lib/redis";

const VALID_TYPES = ["single", "multiple", "truefalse", "fillblank", "cloze"];
const MAX_QUESTIONS = 500;

interface NormalizedQuestion {
  type: string;
  content: string;
  options: { key: string; value: string }[];
  answer: string;
  analysis: string;
  image?: string;
  sortOrder: number;
}

// ============================================================
// 1. JSON Parser
// ============================================================
async function parseJsonFile(content: string) {
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
  if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
  throw new Error("文件格式不正确，请使用 JSON 数组格式");
}

// ============================================================
// 2. Word (.docx) Parser — with image extraction
// ============================================================
async function parseWordDocx(buffer: Buffer) {
  const mammoth = (await import("mammoth")).default;

  const imageData: string[] = [];

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement((image) => {
        return image.readAsBase64String().then((b64) => {
          const dataUri = `data:${image.contentType};base64,${b64}`;
          return { src: dataUri };
        });
      }),
    }
  );

  const text = htmlToTextWithImageMarkers(result.value, imageData);

  return { text, imageData, messages: result.messages };
}

function htmlToTextWithImageMarkers(html: string, imageData: string[]): string {
  return html
    .replace(/<img[^>]+src="([^"]+)"[^>]*\/?>/gi, (_, src) => {
      const idx = imageData.length;
      imageData.push(src);
      return `[IMG_${idx}]`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ============================================================
// 3. Excel (.xlsx) Parser
// ============================================================
async function parseExcelXlsx(buffer: Buffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel 文件没有工作表");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  if (rows.length < 2) throw new Error("Excel 文件至少需要标题行和一行数据");

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

  if (colMap.content === undefined || colMap.answer === undefined) {
    throw new Error(
      "Excel 表头需要包含【题目】和【答案】列。推荐格式: 类型 | 题目 | 选项 | 答案 | 解析 | 图片"
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
      const parts = raw.split(/[;；|｜\n]+/).filter(Boolean);
      if (parts.length >= 2) {
        options = parts.map((part) => {
          const match = part.match(/^([A-E])[.、:：]\s*(.+)/);
          if (match) {
            return { key: match[1], value: match[2].trim() };
          }
          return { key: String.fromCharCode(65 + parts.indexOf(part)), value: part.trim() };
        });
      }
    }

    const image = colMap.image !== undefined
      ? String(row[colMap.image] || "").trim() || undefined
      : undefined;

    questions.push({
      type: VALID_TYPES.includes(type) ? type : "single",
      content,
      options,
      answer,
      analysis,
      image,
      sortOrder: questions.length,
    });
  }

  return questions;
}

// ============================================================
// 4. Extract questions from plain text (used for .docx and fallback)
// ============================================================

const QUESTION_SPLIT_PATTERNS = [
  /(?:^|\n)(?=\d+[.、)）]\s*\S)/,
  /(?:^|\n)(?=第\s*\d+\s*题)/,
  /(?:^|\n)(?=Q\d+[:：])/,
  /(?:^|\n)(?=[一二三四五六七八九十]+[.、)）])/,
  /(?:^|\n)(?=题目\s*\d+\s*[:：])/,
];

function extractQuestionsFromText(text: string, imageData?: string[]): any[] {
  const questions: any[] = [];

  const blocks = splitIntoBlocks(text);

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    const trimmed = block.trim();
    if (trimmed.length < 5) continue;

    const q = parseSingleBlock(trimmed, imageData);
    if (q && q.content.length >= 2) {
      q.sortOrder = questions.length;
      questions.push(q);
    }
  }

  return questions;
}

function splitIntoBlocks(text: string): string[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const blankLineBlocks = cleaned.split(/\n\n+/).filter((b) => b.trim());

  const result: string[] = [];
  for (const block of blankLineBlocks) {
    // Some formats put multiple questions in one blank-line-separated block
    // Try to split further by numbered prefixes
    let remaining = block;
    const parts: string[] = [];

    while (remaining.length > 0) {
      let bestMatch: { index: number; length: number } | null = null;

      for (const pattern of QUESTION_SPLIT_PATTERNS) {
        const m = remaining.match(pattern);
        if (m && m.index !== undefined) {
          // We want to be precise: the split should start at the pattern beginning
          const splitAt = m.index + (m[0].startsWith("\n") ? 1 : 0);
          if (splitAt > 0 && (!bestMatch || splitAt < bestMatch.index)) {
            bestMatch = { index: splitAt, length: 0 };
          }
        }
      }

      if (bestMatch) {
        parts.push(remaining.slice(0, bestMatch.index).trim());
        remaining = remaining.slice(bestMatch.index);
      } else {
        parts.push(remaining.trim());
        break;
      }
    }

    result.push(...parts.filter((p) => p.length > 0));
  }

  return result;
}

// Line-level extraction patterns
const OPTION_LINE = /^([A-E])[.、:：)）]\s*(.+)$/;
const ANSWER_LINE = /^(?:正确答案|答案|Answer)[:：是为]?\s*(.+)$/i;
const ANALYSIS_LINE = /^(?:解析|分析|答案解析|Analysis)[:：]?\s*(.+)$/i;
const IMAGE_MARKER = /\[IMG_(\d+)\]/g;

function parseSingleBlock(block: string, imageData?: string[]): any | null {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const images: string[] = [];
  let contentLines: string[] = [];
  const options: { key: string; value: string }[] = [];
  let answer = "";
  let analysis = "";
  let pastOptions = false;
  let pastAnswer = false;
  let foundAnswer = false;
  let foundAnalysis = false;

  for (const rawLine of lines) {
    // 1) Extract image markers
    let line = rawLine;
    let imgMatch;
    IMAGE_MARKER.lastIndex = 0;
    while ((imgMatch = IMAGE_MARKER.exec(rawLine)) !== null) {
      const imgIdx = parseInt(imgMatch[1], 10);
      if (imageData && imageData[imgIdx]) {
        images.push(imageData[imgIdx]);
      }
      line = line.replace(imgMatch[0], "").trim();
    }

    if (!line) continue;

    // 2) Check for answer
    const ansMatch = line.match(ANSWER_LINE);
    if (ansMatch) {
      answer = ansMatch[1].trim();
      foundAnswer = true;
      pastAnswer = true;
      continue;
    }

    // 3) Check for analysis (after answer found)
    const anaMatch = line.match(ANALYSIS_LINE);
    if (anaMatch) {
      analysis = anaMatch[1].trim();
      foundAnalysis = true;
      continue;
    }

    // 4) If we've seen analysis, append to it
    if (foundAnalysis) {
      analysis += "\n" + line;
      continue;
    }

    // 5) Check for option lines
    const optMatch = line.match(OPTION_LINE);
    if (optMatch) {
      options.push({ key: optMatch[1], value: optMatch[2].trim() });
      pastOptions = true;
      continue;
    }

    // 6) If we're past options but haven't found answer, check inline
    if (pastOptions && !foundAnswer) {
      const inlineAns = line.match(/答案[:：]\s*(.+)/);
      if (inlineAns) {
        answer = inlineAns[1].trim();
        foundAnswer = true;
        pastAnswer = true;
        continue;
      }
      const inlineAna = line.match(/解析[:：]\s*(.+)/);
      if (inlineAna) {
        analysis = inlineAna[1].trim();
        foundAnalysis = true;
        continue;
      }
    }

    // 7) Otherwise it's content
    if (!pastOptions || options.length === 0) {
      contentLines.push(line);
    } else if (!pastAnswer) {
      // Past options but not yet at answer — could be content or stray lines
      // Check if it looks like an option prefix
      if (line.match(/^[A-E][.、:：)]/) || line.match(/^答案/) || line.match(/^解析/)) {
        // Retry matching
        const retryAns = line.match(ANSWER_LINE);
        if (retryAns) { answer = retryAns[1].trim(); foundAnswer = true; pastAnswer = true; continue; }
        const retryAna = line.match(ANALYSIS_LINE);
        if (retryAna) { analysis = retryAna[1].trim(); foundAnalysis = true; continue; }
        const retryOpt = line.match(OPTION_LINE);
        if (retryOpt) { options.push({ key: retryOpt[1], value: retryOpt[2].trim() }); continue; }
      }
      contentLines.push(line);
    }
  }

  let content = contentLines.join("\n").trim();

  // Remove common leading number patterns from content
  content = content.replace(/^\d+[.、)）]\s*/, "");
  content = content.replace(/^第\s*\d+\s*题\s*[:：]?\s*/, "");
  content = content.replace(/^Q\d+[:：]\s*/i, "");
  content = content.replace(/^[一二三四五六七八九十]+[.、)）]\s*/, "");
  content = content.replace(/^题目\s*\d+\s*[:：]\s*/, "");

  // Auto-detect type
  let detectedType = detectQuestionType(content, options, answer);

  // Build question
  const q: any = {
    type: detectedType,
    content,
    options,
    answer,
    analysis,
    sortOrder: 0,
  };

  if (images.length > 0) {
    q.image = images[0];
    if (images.length > 1) {
      // Add additional images as markers in content
      const extraMarkers = images.slice(1).map((uri) => `[图片]`).join(" ");
      q.content = (q.content + " " + extraMarkers).trim();
    }
  }

  // Clean empty options for truefalse/fillblank
  if (["truefalse", "fillblank"].includes(detectedType)) {
    q.options = [];
  }

  return q;
}

function detectQuestionType(
  content: string,
  options: { key: string; value: string }[],
  answer: string
): string {
  const lowerAns = answer.toLowerCase().trim();

  // Check if it's true/false
  const trueValues = ["对", "正确", "true", "t", "是", "yes", "y", "√", "✓", "✔"];
  const falseValues = ["错", "错误", "false", "f", "否", "no", "n", "×", "✗", "✘"];
  if (
    trueValues.includes(lowerAns) ||
    falseValues.includes(lowerAns)
  ) {
    return "truefalse";
  }

  // Check for fill-in-blank
  if (
    content.includes("____") ||
    content.includes("___") ||
    content.includes("（  ）") ||
    content.includes("(  )") ||
    content.includes("（ ）") ||
    content.includes("()")
  ) {
    return "fillblank";
  }

  // Has options — check for multiple choice
  const validOptions = options.filter((o) => o.value.trim());
  if (validOptions.length >= 2) {
    // If answer contains commas or multiple letters, it's likely multiple
    const answerParts = answer.split(/[,，、\s]+/).filter(Boolean);
    if (answerParts.length > 1) {
      return "multiple";
    }
    return "single";
  }

  return "single";
}

// ============================================================
// 5. Validate & Normalize
// ============================================================
function validateAndNormalize(
  rawQuestions: any[]
): { questions: NormalizedQuestion[]; errors: string[] } {
  const parsedQuestions: NormalizedQuestion[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const rowErrors: string[] = [];

    const content = typeof q.content === "string" ? q.content.trim() : "";
    if (!content) rowErrors.push("缺少题目内容");

    const answer = typeof q.answer === "string" ? q.answer.trim() : "";
    if (!answer) rowErrors.push("缺少答案");

    let type = q.type || "single";
    if (!VALID_TYPES.includes(type)) {
      type = "single";
    }

    let options = q.options || [];
    if (typeof options === "string") {
      try {
        options = JSON.parse(options);
      } catch {
        options = [];
      }
    }
    if (!Array.isArray(options)) options = [];

    // For single/multiple with options, verify answer is valid
    if (
      (type === "single" || type === "multiple") &&
      options.length > 0 &&
      !["truefalse", "fillblank", "cloze"].includes(type)
    ) {
      const optionKeys = options.map((o: any) => o.key);
      const answerKeys = answer.split(/[,，、\s]+/).filter(Boolean);
      const invalidKeys = answerKeys.filter((k: string) => !optionKeys.includes(k));
      if (invalidKeys.length > 0 && answerKeys.length === invalidKeys.length) {
        // All answer keys invalid — but don't fail, just warn
        // rowErrors.push(`答案中的选项 "${invalidKeys.join(",")}" 在选项中不存在`);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(`第 ${i + 1} 题: ${rowErrors.join(", ")}`);
      continue;
    }

    let image = q.image || undefined;
    // Validate image is a valid data URI
    if (image && typeof image === "string") {
      if (!image.startsWith("data:image/") && !image.startsWith("http")) {
        image = undefined;
      }
    }

    parsedQuestions.push({
      type,
      content,
      options: ["truefalse", "fillblank"].includes(type) ? [] : options,
      answer,
      analysis: typeof q.analysis === "string" ? q.analysis.trim() : "",
      image,
      sortOrder: i,
    });
  }

  return { questions: parsedQuestions, errors };
}

// ============================================================
// 6. POST Handler
// ============================================================
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

    // -- JSON --
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
    }
    // -- Word (.docx) --
    else if (
      fileName.endsWith(".docx") ||
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const { text, imageData } = await parseWordDocx(buffer);
      if (!text.trim()) {
        return Response.json({ error: "Word 文档内容为空" }, { status: 400 });
      }
      rawQuestions = extractQuestionsFromText(text, imageData);
      if (rawQuestions.length === 0) {
        return Response.json(
          {
            error:
              "未能从 Word 文档中解析出题目，请确保格式为: 题目编号 + 题目内容 + 选项(A.B.C.D) + 答案 + 解析",
            rawText: text.slice(0, 500),
          },
          { status: 400 }
        );
      }
    }
    // -- Excel (.xlsx / .xls) --
    else if (
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel")
    ) {
      try {
        rawQuestions = await parseExcelXlsx(buffer);
      } catch (err: any) {
        return Response.json(
          { error: err.message || "Excel 文件解析失败" },
          { status: 400 }
        );
      }
    }
    // -- Unsupported --
    else {
      return Response.json(
        {
          error:
            "不支持的文件格式，请上传 JSON、Word (.docx) 或 Excel (.xlsx) 文件",
        },
        { status: 400 }
      );
    }

    if (rawQuestions.length === 0) {
      return Response.json({ error: "文件中没有找到题目" }, { status: 400 });
    }

    if (rawQuestions.length > MAX_QUESTIONS) {
      return Response.json(
        { error: `单次最多上传 ${MAX_QUESTIONS} 道题目` },
        { status: 400 }
      );
    }

    const { questions: parsedQuestions, errors } =
      validateAndNormalize(rawQuestions);

    if (parsedQuestions.length === 0) {
      return Response.json(
        {
          error: "没有有效的题目可以导入",
          details: errors,
        },
        { status: 400 }
      );
    }

    // -- Save to bank if bankId provided --
    if (bankId) {
      const bank = await prisma.questionBank.findUnique({
        where: { id: bankId },
        select: { id: true, uploaderId: true },
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
          { error: "无权向该题库添加题目" },
          { status: 403 }
        );
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

    // -- Return parsed questions for preview --
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
