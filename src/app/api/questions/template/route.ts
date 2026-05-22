import { NextResponse } from "next/server";

export async function GET() {
  const template = {
    questions: [
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
    ],
  };

  return NextResponse.json(template, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="novamind-question-template.json"',
    },
  });
}
