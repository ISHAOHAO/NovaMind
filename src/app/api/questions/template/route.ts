import { NextRequest, NextResponse } from "next/server";

const SAMPLE_QUESTIONS = [
  {
    type: "single",
    content: "以下哪个是 JavaScript 的数据类型？",
    options: [
      { key: "A", value: "String" },
      { key: "B", value: "Integer" },
      { key: "C", value: "Float" },
      { key: "D", value: "Character" },
    ],
    answer: "A",
    analysis: "JavaScript 有 String、Number、Boolean 等基本数据类型，但没有 Integer、Float、Character 这些类型。",
  },
  {
    type: "multiple",
    content: "以下哪些是 React Hook？",
    options: [
      { key: "A", value: "useState" },
      { key: "B", value: "useEffect" },
      { key: "C", value: "useComponent" },
      { key: "D", value: "useContext" },
    ],
    answer: "A,B,D",
    analysis: "useState、useEffect、useContext 都是 React 内置 Hook，useComponent 不存在。",
  },
  {
    type: "truefalse",
    content: "TypeScript 是 JavaScript 的超集。",
    options: [],
    answer: "true",
    analysis: "TypeScript 扩展了 JavaScript 的语法并添加了类型系统。",
  },
  {
    type: "fillblank",
    content: "在 CSS 中，_____ 属性用于设置元素的背景颜色。",
    options: [],
    answer: "background-color",
    analysis: "background-color 是 CSS 中设置背景颜色的标准属性。",
  },
  {
    type: "cloze",
    content: "JavaScript 是一种__1__语言，主要用于__2__开发。它的变量声明可以使用__3__、let 或 const。",
    options: [
      { key: "1", value: "A. 编译型|B. 解释型|C. 标记型|D. 汇编型" },
      { key: "2", value: "A. 后端|B. 桌面|C. 前端|D. 移动端" },
      { key: "3", value: "A. var|B. int|C. string|D. float" },
    ],
    answer: "B,C,A",
    analysis: "JavaScript 是解释型脚本语言，主要用于前端 Web 开发，变量声明使用 var、let 或 const。",
  },
];

function generateJsonTemplate() {
  return {
    questions: SAMPLE_QUESTIONS,
  };
}

async function generateExcelTemplate() {
  const XLSX = await import("xlsx");

  const header = ["类型", "题目", "选项", "答案", "解析", "图片"];
  const typeLabels: Record<string, string> = {
    single: "单选题", multiple: "多选题", truefalse: "判断题",
    fillblank: "填空题", cloze: "完形填空",
  };

  const rows = [header];
  for (const q of SAMPLE_QUESTIONS) {
    const optionsStr = q.options.length > 0
      ? q.options.map((o) => `${o.key}. ${o.value}`).join("; ")
      : "";
    rows.push([
      typeLabels[q.type] || q.type,
      q.content,
      optionsStr,
      q.answer,
      q.analysis,
      "",
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!cols"] = [
    { wch: 10 }, { wch: 50 }, { wch: 40 }, { wch: 15 }, { wch: 40 }, { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "题库模板");

  // Add usage instruction sheet
  const instructions = [
    ["NovaMind 题库上传模板使用说明"],
    [""],
    ["一、基本格式要求"],
    ["1. 类型列填写：单选题 / 多选题 / 判断题 / 填空题 / 完形填空"],
    ["2. 题目内容为必填项"],
    ["3. 选项格式：单选题/多选题使用 A. 内容 格式，多个选项用分号(;)分隔，如：A. 选项1; B. 选项2; C. 选项3"],
    ["4. 答案格式：单选题填字母如 A；多选题用逗号分隔如 A,B,D；判断题填 true 或 false；填空题填完整答案"],
    ["5. 解析为可选项，填写答案解析"],
    ["6. 图片为可选项，填写图片URL"],
    [""],
    ["二、完形填空特别说明"],
    ["1. 题目内容中使用 __1__、__2__、__3__ 标记每个空白处"],
    ["    示例：JavaScript是一种__1__语言，主要用于__2__开发。"],
    ["2. 选项列格式：每个空白的选项用分号(;)分隔，空白内选项用竖线(|)分隔"],
    ["    示例：1. A. 编译型|B. 解释型|C. 标记型|D. 汇编型; 2. A. 后端|B. 桌面|C. 前端|D. 移动端"],
    ["3. 答案格式：按空白顺序用逗号分隔每个空白的答案字母"],
    ["    示例：B,C 表示空白1选B，空白2选C"],
    [""],
    ["三、注意事项"],
    ["1. 请勿修改列的顺序"],
    ["2. 请确保每道题目都有题目内容和答案"],
    ["3. 选择题必须有至少2个选项"],
    ["4. 上传前可以使用 AI 分析功能检查题目质量"],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "使用说明");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return Buffer.from(buffer);
}

const WML_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wmlParagraph(text: string, opts?: { bold?: boolean }): string {
  const rPrParts: string[] = [];
  if (opts?.bold) rPrParts.push(`<w:b/>`);
  const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : "";
  return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function wmlEmptyParagraph(): string {
  return `<w:p></w:p>`;
}

async function generateWordTemplate(): Promise<Buffer> {
  const typeLabels: Record<string, string> = {
    single: "单选题", multiple: "多选题", truefalse: "判断题",
    fillblank: "填空题", cloze: "完形填空",
  };

  const paragraphs: string[] = [];

  // Title
  paragraphs.push(wmlParagraph("NovaMind 题库上传模板", { bold: true }));
  paragraphs.push(wmlEmptyParagraph());

  // Usage instructions
  paragraphs.push(wmlParagraph("使用说明", { bold: true }));
  paragraphs.push(wmlParagraph("按照下面的格式编辑您的题目，每道题之间用空行分隔。"));
  paragraphs.push(wmlEmptyParagraph());

  // Format requirements
  paragraphs.push(wmlParagraph("格式要求", { bold: true }));
  paragraphs.push(wmlParagraph("1. 每道题以「数字. 」或「数字、」开头，后面跟题目内容。"));
  paragraphs.push(wmlParagraph("2. 单选题/多选题选项格式：A. 选项内容，每个选项单独一行。"));
  paragraphs.push(wmlParagraph("3. 答案格式：答案：A （多选用逗号分隔，如 答案：A,B,D）。"));
  paragraphs.push(wmlParagraph("4. 解析格式：解析：解析内容。"));
  paragraphs.push(wmlParagraph("5. 题目之间用空行分隔。"));
  paragraphs.push(wmlParagraph("6. 判断题答案填 true 或 false。"));
  paragraphs.push(wmlParagraph("7. 完形填空格式：题目内容中使用 __1__、__2__ 标记空白处；每个空白的选项格式为 1. A. 选项1|B. 选项2|C. 选项3|D. 选项4；答案格式如 答案：B,C,A。"));
  paragraphs.push(wmlEmptyParagraph());

  // Example questions section header
  paragraphs.push(wmlParagraph("示例题目（请替换为您的题目）", { bold: true }));
  paragraphs.push(wmlEmptyParagraph());

  SAMPLE_QUESTIONS.forEach((q, i) => {
    const prefix = `${i + 1}. [${typeLabels[q.type] || q.type}] `;
    paragraphs.push(wmlParagraph(prefix + q.content, { bold: true }));

    q.options.forEach((o) => {
      paragraphs.push(wmlParagraph(`${o.key}. ${o.value}`));
    });

    paragraphs.push(wmlParagraph(`答案：${q.answer}`));

    if (q.analysis) {
      paragraphs.push(wmlParagraph(`解析：${q.analysis}`));
    }

    // Empty paragraph as separator between questions
    paragraphs.push(wmlEmptyParagraph());
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WML_NS}">
  <w:body>
${paragraphs.join("\n")}
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const JSZipModule = await import("jszip");
  const JSZip = (JSZipModule as any).default || JSZipModule;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml);
  zip.file("_rels/.rels", relsXml);
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", docRelsXml);

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return zipBuffer;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";

  switch (format) {
    case "excel": {
      const buffer = await generateExcelTemplate();
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="novamind-template.xlsx"',
        },
      });
    }

    case "word": {
      const buffer = await generateWordTemplate();
      return new NextResponse(buffer as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": 'attachment; filename="novamind-template.docx"',
        },
      });
    }

    default: {
      const template = generateJsonTemplate();
      return NextResponse.json(template, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="novamind-template.json"',
        },
      });
    }
  }
}
