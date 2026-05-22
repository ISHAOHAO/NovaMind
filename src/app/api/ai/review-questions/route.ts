import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getSystemConfig } from "@/lib/config";
import { askAi } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const aiEnabled = await getSystemConfig("ai_enabled");
    if (aiEnabled !== "true") {
      return NextResponse.json({ error: "AI 功能未启用" }, { status: 403 });
    }

    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "请提供题目列表" }, { status: 400 });
    }

    if (questions.length > 50) {
      return NextResponse.json({ error: "单次最多审查 50 道题目" }, { status: 400 });
    }

    const questionsForPrompt = questions.map((q: any, i: number) => {
      let optionsStr = "";
      if (Array.isArray(q.options) && q.options.length > 0) {
        optionsStr = q.options
          .map((o: any) => `${o.key}: ${o.value}`)
          .join("\n");
      }
      return `【题目 ${i + 1}】
类型: ${q.type || "single"}
内容: ${q.content || ""}
${optionsStr ? `选项:\n${optionsStr}` : ""}
答案: ${q.answer || ""}
解析: ${q.analysis || "无"}
---`;
    }).join("\n\n");

    const prompt = `你是一个专业的题目审查助手。请审查以下题目，检查是否存在以下问题：

1. 答案与题目内容不一致（如单选题答案是选项不存在的选项）
2. 题目内容有明显知识性错误
3. 选项设计不合理（如单选题有多个明显正确答案）
4. 答案格式不正确（如多选题答案未用逗号分隔）
5. 解析与答案矛盾
6. 填空题答案不完整

请以 JSON 数组格式返回审查结果。每个元素包含：
- index: 题目序号（从1开始）
- hasIssue: 是否有问题 (true/false)
- severity: 严重程度 ("error" | "warning" | "info")
- message: 问题描述（无问题则为"通过"）
- suggestion: 修改建议（无问题则为空字符串）

只返回 JSON 数组，不要有其他内容。

题目列表：
${questionsForPrompt}`;

    const result = await askAi(
      prompt,
      "你是一个专业的题目审查助手。你只返回 JSON 格式的审查结果。"
    );

    try {
      let content = result.content || "";
      content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const reviews = JSON.parse(content);
      return NextResponse.json({ success: true, reviews });
    } catch {
      return NextResponse.json({
        success: true,
        content: result.content,
        note: "AI 返回了非标准格式，请查看原始内容",
      });
    }
  } catch (error) {
    console.error("[AI Review] Error:", error);
    return NextResponse.json({ error: "AI 审查失败" }, { status: 500 });
  }
}
