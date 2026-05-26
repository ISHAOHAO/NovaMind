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

    // Map Chinese type labels to English values
    const typeLabelMap: Record<string, string> = {
      "单选题": "single", "单选": "single",
      "多选题": "multiple", "多选": "multiple",
      "判断题": "truefalse", "判断": "truefalse",
      "填空题": "fillblank", "填空": "fillblank",
      "完形填空": "cloze", "cloze": "cloze",
    };
    const mappedType = typeLabelMap[type] || type;

    const answer = String(row[colMap.answer] || "").trim();
    const analysis = colMap.analysis !== undefined
      ? String(row[colMap.analysis] || "").trim()
      : "";

    let options: { key: string; value: string }[] = [];
    const typeLower = mappedType.toLowerCase();
    if (colMap.options !== undefined && row[colMap.options]) {
      const raw = String(row[colMap.options]).trim();

      if (typeLower === "cloze" || type === "完形填空") {
        // Cloze: split by semicolons first to get each blank, then preserve
        // pipe-separated choices within each blank
        const blankParts = raw.split(/[;；\n]+/).filter(Boolean);
        options = blankParts.map((part) => {
          const match = part.trim().match(/^(\d+)\s*[.、]\s*(.+)$/);
          if (match) {
            return { key: match[1], value: match[2].trim() };
          }
          return { key: String(blankParts.indexOf(part) + 1), value: part.trim() };
        });
      } else {
        // Regular options: split by common separators
        const parts = raw.split(/[;；\n]+/).filter(Boolean);
        if (parts.length >= 2) {
          options = parts.map((part) => {
            const match = part.trim().match(/^([A-E])[.、:：]\s*(.+)/);
            if (match) {
              return { key: match[1], value: match[2].trim() };
            }
            return { key: String.fromCharCode(65 + parts.indexOf(part)), value: part.trim() };
          });
        }
      }
    }

    // Determine actual type with all info available
    const detectedType = detectQuestionType(content, options, answer);
    const finalType = VALID_TYPES.includes(typeLower) ? typeLower : detectedType;

    const image = colMap.image !== undefined
      ? String(row[colMap.image] || "").trim() || undefined
      : undefined;

    questions.push({
      type: finalType,
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
// 3.5 Fallback text extractor for old binary .doc files
// ============================================================
function extractTextFromDocBinary(buffer: Buffer): string {
  // Old .doc (OLE2) files store text in the WordDocument stream.
  // While we can't fully parse OLE2 without a library, much of the
  // text content is stored as UTF-16LE or appears as readable ASCII
  // sequences within the binary. We try several strategies:

  let text = "";

  // Strategy 1: Try extracting UTF-16LE text runs (common in .doc)
  // Look for sequences of valid UTF-16LE characters
  const utf16Parts: string[] = [];
  let runStart = -1;
  for (let i = 0; i < buffer.length - 1; i += 2) {
    const code = buffer.readUInt16LE(i);
    // Valid printable CJK or ASCII range
    if (
      (code >= 0x20 && code <= 0x7E) || // ASCII printable
      (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified
      (code >= 0x3000 && code <= 0x303F) || // CJK punctuation
      (code >= 0xFF00 && code <= 0xFFEF) || // Halfwidth/Fullwidth
      (code >= 0x2000 && code <= 0x206F) || // General punctuation
      code === 0x0D || code === 0x0A // CR/LF
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

  // Strategy 2: Fallback — extract ASCII runs as latin1
  if (text.length < 20) {
    const latin1 = buffer.toString("latin1");
    // Filter to printable lines
    const lines = latin1.split(/[\r\n]+/).filter((line) => {
      const cleaned = line.replace(/[^\x20-\x7E\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g, "");
      return cleaned.length >= 10;
    });
    text = lines.join("\n");
  }

  // Clean up
  text = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // remove control chars except \t\n\r
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
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
const CLOZE_BLANK_LINE = /^(\d+)\s*[.、]\s*([A-D]\.\s*.+)$/;
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

    // 5b) Check for cloze blank lines (e.g. "1. A. xxx|B. yyy")
    const clozeMatch = line.match(CLOZE_BLANK_LINE);
    if (clozeMatch) {
      options.push({ key: clozeMatch[1], value: clozeMatch[2].trim() });
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
      if (line.match(/^[A-E][.、:：)]/) || line.match(/^\d+[.、]/) || line.match(/^答案/) || line.match(/^解析/)) {
        // Retry matching
        const retryAns = line.match(ANSWER_LINE);
        if (retryAns) { answer = retryAns[1].trim(); foundAnswer = true; pastAnswer = true; continue; }
        const retryAna = line.match(ANALYSIS_LINE);
        if (retryAna) { analysis = retryAna[1].trim(); foundAnalysis = true; continue; }
        const retryOpt = line.match(OPTION_LINE);
        if (retryOpt) { options.push({ key: retryOpt[1], value: retryOpt[2].trim() }); continue; }
        const retryCloze = line.match(CLOZE_BLANK_LINE);
        if (retryCloze) { options.push({ key: retryCloze[1], value: retryCloze[2].trim() }); continue; }
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

  // Check if it's true/false (must check before cloze/fillblank since
  // true/false answers are very specific)
  const trueValues = ["对", "正确", "true", "t", "是", "yes", "y", "√", "✓", "✔"];
  const falseValues = ["错", "错误", "false", "f", "否", "no", "n", "×", "✗", "✘"];
  if (
    trueValues.includes(lowerAns) ||
    falseValues.includes(lowerAns)
  ) {
    return "truefalse";
  }

  // Check for cloze — content has numbered blanks like __1__, __2__
  if (/__\d+__/.test(content) || /___\d+___/.test(content)) {
    return "cloze";
  }

  // Also detect cloze from options: if options keys are numbers (1, 2, 3...)
  // and values contain pipe-separated A/B/C/D choices
  const validOptions = options.filter((o) => o.value.trim());
  if (validOptions.length >= 1) {
    const hasNumberedKeys = validOptions.every((o) => /^\d+$/.test(o.key));
    const hasPipeSeparatedChoices = validOptions.some((o) => /[A-D]\.\s*.+[|｜][A-D]\.\s*.+/.test(o.value));
    if (hasNumberedKeys && hasPipeSeparatedChoices) {
      return "cloze";
    }
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
    // -- Word (.docx / .doc) --
    else if (
      fileName.endsWith(".docx") ||
      fileName.endsWith(".doc") ||
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      try {
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
      } catch {
        // .doc files may fail mammoth — try binary text extraction as fallback
        if (fileName.endsWith(".doc") && !fileName.endsWith(".docx")) {
          const extracted = extractTextFromDocBinary(buffer);
          if (extracted.trim().length < 10) {
            return Response.json(
              {
                error:
                  "无法解析旧版 .doc 文件，请使用 Microsoft Word 将文件另存为 .docx 格式后再上传",
              },
              { status: 400 }
            );
          }
          rawQuestions = extractQuestionsFromText(extracted);
          if (rawQuestions.length === 0) {
            return Response.json(
              {
                error:
                  "未能从 .doc 文档中解析出题目。请确保按照模板格式编辑，或另存为 .docx 格式后重试",
                rawText: extracted.slice(0, 500),
              },
              { status: 400 }
            );
          }
        } else {
          return Response.json(
            { error: "Word 文档解析失败，请确保文件未损坏且格式正确" },
            { status: 400 }
          );
        }
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
            "不支持的文件格式，请上传 JSON、Word (.docx / .doc) 或 Excel (.xlsx / .xls) 文件",
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
