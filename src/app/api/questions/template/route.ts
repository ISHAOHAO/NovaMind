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
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return Buffer.from(buffer);
}

function generateWordTemplate(): string {
  const typeLabels: Record<string, string> = {
    single: "单选题", multiple: "多选题", truefalse: "判断题",
    fillblank: "填空题", cloze: "完形填空",
  };

  let body = "";
  SAMPLE_QUESTIONS.forEach((q, i) => {
    body += `
      <div style="margin-bottom:24px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <h3 style="color:#2563eb; margin:0 0 8px;">${i + 1}. [${typeLabels[q.type] || q.type}] ${escapeHtml(q.content)}</h3>
        ${q.options.length > 0 ? `
        <div style="margin-left:16px; margin-bottom:8px;">
          ${q.options.map((o) => `<p style="margin:4px 0;"><strong>${o.key}.</strong> ${escapeHtml(o.value)}</p>`).join("")}
        </div>` : ""}
        <p style="margin:4px 0;"><strong style="color:#16a34a;">答案：</strong>${escapeHtml(q.answer)}</p>
        ${q.analysis ? `<p style="margin:4px 0;"><strong>解析：</strong>${escapeHtml(q.analysis)}</p>` : ""}
      </div>`;
  });

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>NovaMind 题库模板</title>
      <style>
        body { font-family: "Microsoft YaHei", "微软雅黑", sans-serif; padding: 20px; line-height: 1.8; }
        h2 { color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
        .tip { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 8px 12px; margin: 12px 0; font-size: 14px; }
        .note { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 8px 12px; margin: 12px 0; font-size: 14px; }
      </style>
    </head>
    <body>
      <h2>NovaMind 题库上传模板</h2>
      <div class="tip"><strong>使用说明：</strong>将此文件内容复制到 Word 中，按照下面的格式编辑您的题目。每道题之间用空行分隔。</div>
      <div class="note">
        <strong>格式要求：</strong><br/>
        1. 每道题以 "数字. " 开头<br/>
        2. 选项格式：A. 选项内容<br/>
        3. 答案格式：答案：A<br/>
        4. 解析格式：解析：解析内容<br/>
        5. 题目之间用空行分隔
      </div>
      ${body}
    </body>
    </html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
      const html = generateWordTemplate();
      const buf = Buffer.from(html, "utf-8");
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/msword",
          "Content-Disposition": 'attachment; filename="novamind-template.doc"',
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
