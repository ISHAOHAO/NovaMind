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

    const typeLabelMap: Record<string, string> = {
      single: "单选题", multiple: "多选题", truefalse: "判断题",
      fillblank: "填空题", cloze: "完形填空",
    };

    const questionsForPrompt = questions.map((q: any, i: number) => {
      const typeLabel = typeLabelMap[q.type] || q.type || "single";
      let optionsStr = "";
      if (Array.isArray(q.options) && q.options.length > 0) {
        if (q.type === "cloze") {
          optionsStr = "空白选项:" + q.options
            .map((o: any) => `${o.key}:${o.value}`)
            .join("; ");
        } else {
          optionsStr = "选项:" + q.options
            .map((o: any) => `${o.key}:${o.value}`)
            .join(", ");
        }
      }
      const analysisSnippet = q.analysis ? ` 解析:${String(q.analysis).slice(0, 80)}` : "";
      return `[${i + 1}] ${typeLabel} | ${q.content || ""} | ${optionsStr} | 答案:${q.answer || ""}${analysisSnippet}`;
    }).join("\n");

    const prompt = `审查以下题目，检查：答案是否在选项中、选项是否合理、判断题正误、答案格式是否正确、解析是否与答案一致。

返回 JSON 数组（无其他内容）：
[{ "index": 题号, "hasIssue": true/false, "severity": "error"|"warning"|"info", "message": "问题描述", "suggestion": "修改建议" }]
无问题题目：{ "index": 题号, "hasIssue": false, "severity": "info", "message": "通过", "suggestion": "" }

题目：
${questionsForPrompt}`;

    const result = await askAi(
      prompt,
      "你是题库审查助手。只返回 JSON 数组，不要任何解释文字。格式：[{index,hasIssue,severity,message,suggestion}]"
    );

    if (!result.success || !result.content) {
      return NextResponse.json(
        { error: result.error || "AI 服务返回异常，请稍后重试" },
        { status: 500 }
      );
    }

    try {
      let content = result.content || "";
      content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const reviews = JSON.parse(content);
      return NextResponse.json({ success: true, reviews });
    } catch {
      return NextResponse.json({
        success: true,
        reviews: [{ index: 0, hasIssue: true, severity: "warning", message: "AI 返回格式异常，无法解析审查结果", suggestion: "请手动核验题目，或稍后重试 AI 分析" }],
        rawContent: result.content.slice(0, 2000),
        note: "AI 返回了非标准格式，请查看原始内容",
      });
    }
  } catch (error) {
    console.error("[AI Review] Error:", error);
    return NextResponse.json({ error: "AI 审查失败" }, { status: 500 });
  }
}
