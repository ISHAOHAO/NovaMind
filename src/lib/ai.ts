import { prisma } from "./prisma";
import { createHash } from "crypto";

interface AiResponse {
  success: boolean;
  content: string;
  error?: string;
  cached?: boolean;
}

async function getAiConfig() {
  const [provider, apiKey, model, baseUrl, enabled] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "ai_provider" } }),
    prisma.systemConfig.findUnique({ where: { key: "ai_api_key" } }),
    prisma.systemConfig.findUnique({ where: { key: "ai_model" } }),
    prisma.systemConfig.findUnique({ where: { key: "ai_base_url" } }),
    prisma.systemConfig.findUnique({ where: { key: "ai_enabled" } }),
  ]);

  return {
    provider: provider?.value || "openai",
    apiKey: apiKey?.value || "",
    model: model?.value || "gpt-4o-mini",
    baseUrl: baseUrl?.value || "https://api.openai.com/v1",
    enabled: enabled?.value === "true",
  };
}

function hashPrompt(prompt: string, systemPrompt: string, model: string): string {
  return createHash("sha256")
    .update(`${model}:${systemPrompt}:${prompt}`)
    .digest("hex");
}

function cleanAiContent(content: string): string {
  let cleaned = content.trim();
  cleaned = cleaned.replace(/```[a-z]*\s*/gi, "");
  cleaned = cleaned.replace(/```/g, "");
  cleaned = cleaned.trim();
  return cleaned;
}

async function getCachedResponse(promptHash: string): Promise<string | null> {
  try {
    const cached = await prisma.aiCache.findUnique({
      where: { promptHash },
      select: { response: true, expiresAt: true },
    });
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return cached.response;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveToCache(
  promptHash: string,
  prompt: string,
  response: string,
  model: string
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.aiCache.upsert({
      where: { promptHash },
      update: { response, expiresAt },
      create: { promptHash, prompt, response, model, expiresAt },
    });
  } catch {
    // 缓存保存失败不影响主流程
  }
}

export async function askAi(
  prompt: string,
  systemPrompt?: string,
  skipCache: boolean = false
): Promise<AiResponse> {
  const config = await getAiConfig();

  if (!config.enabled || !config.apiKey) {
    return { success: false, content: "", error: "AI 功能未启用或未配置 API Key" };
  }

  const promptHash = hashPrompt(prompt, systemPrompt || "", config.model);

  if (!skipCache) {
    const cached = await getCachedResponse(promptHash);
    if (cached) {
      return { success: true, content: cached, cached: true };
    }
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          ...(systemPrompt
            ? [{ role: "system", content: systemPrompt }]
            : []),
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = cleanAiContent(data.choices?.[0]?.message?.content || "");

    await saveToCache(promptHash, prompt, content, config.model);

    return { success: true, content, cached: false };
  } catch (error) {
    console.error("AI request failed:", error);
    return {
      success: false,
      content: "",
      error: error instanceof Error ? error.message : "AI 请求失败",
    };
  }
}

function buildAnalyzePrompt(questionContent: string, answer: string, analysis?: string): string {
  return `
你是一位专业的考试辅导老师。请对以下题目进行详细解析：

题目：${questionContent}
正确答案：${answer}
${analysis ? `已有解析：${analysis}` : ""}

请使用 HTML 格式输出，结构如下：
<div class="analysis">
  <h3>📌 考点分析</h3>
  <p>...考点内容...</p>
  <h3>💡 解题思路</h3>
  <p>...解题思路...</p>
  <h3>📋 选项分析</h3>
  <ul>
    <li><strong>A</strong>: ...分析...</li>
    <li><strong>B</strong>: ...分析...</li>
  </ul>
  <h3>📚 知识拓展</h3>
  <p>...相关知识拓展...</p>
</div>

要求：
- 必须使用 HTML 格式，不要输出 JSON 或纯文本
- 使用内联 style 属性设置颜色和样式，使内容美观易读
- 重点内容用不同颜色标注（正确用绿色 #16a34a，错误用红色 #dc2626）
- 不要使用 Markdown 代码块标记
`;
}

function buildExplainPrompt(questionContent: string, answer: string): string {
  return `
请用通俗易懂的方式讲解以下题目的答案：

题目：${questionContent}
答案：${answer}

要求：
1. 用简单清晰的语言解释
2. 适合初学者理解
3. 使用 HTML 格式输出，结构如下：
<div style="padding:12px; border-radius:8px; background:#f0f9ff;">
  <h3 style="color:#2563eb;">📖 答案讲解</h3>
  <p>...通俗易懂的讲解内容...</p>
  ${answer ? `<p style="margin-top:8px;"><strong style="color:#16a34a;">正确答案：${answer}</strong></p>` : ""}
</div>
4. 必须使用 HTML 格式，不要输出 JSON 或纯文本
5. 不要使用 Markdown 代码块标记
`;
}

function buildSimilarQuestionPrompt(questionContent: string, answer: string): string {
  return `
请根据以下题目，生成一道相似的变体题目：

原题：${questionContent}
原题答案：${answer}

要求：
1. 保持相同的知识点和难度
2. 改变题目数据或表述方式
3. 使用 HTML 格式直接输出，结构如下（不要输出 JSON 或 Markdown 代码块）：

<div style="padding:12px; border-radius:8px; background:#fef3c7; border:1px solid #fcd34d;">
  <h3 style="color:#d97706;">🔀 相似题</h3>
  <div style="background:#fff;padding:12px;border-radius:6px;margin:8px 0;">
    <p style="font-weight:bold;">题目：</p>
    <p>...生成的题目内容...</p>
    <p style="margin-top:8px;">A. ...选项A...</p>
    <p>B. ...选项B...</p>
    <p>C. ...选项C...</p>
    <p>D. ...选项D...</p>
  </div>
  <p style="margin-top:8px;"><strong style="color:#16a34a;">正确答案：</strong>...答案...</p>
  <p style="margin-top:4px;"><strong>解析：</strong>...解析内容...</p>
</div>

4. 绝对不要输出 JSON 格式，不要使用 \`\`\` 代码块标记
5. 只输出上述 HTML 结构
`;
}

export async function analyzeQuestion(
  questionContent: string,
  answer: string,
  analysis?: string
): Promise<AiResponse> {
  const prompt = buildAnalyzePrompt(questionContent, answer, analysis);
  return askAi(prompt, "你是一位专业的考试辅导老师，请以中文回答。");
}

export async function explainAnswer(
  questionContent: string,
  answer: string
): Promise<AiResponse> {
  const prompt = buildExplainPrompt(questionContent, answer);
  return askAi(prompt, "你是一位耐心的老师，请以中文回答。");
}

export async function generateSimilarQuestion(
  questionContent: string,
  answer: string
): Promise<AiResponse> {
  const prompt = buildSimilarQuestionPrompt(questionContent, answer);
  return askAi(
    prompt,
    "你是出题专家。请严格按照要求的 HTML 格式返回，不要使用 JSON 或 Markdown 代码块。"
  );
}

export async function generateQuestionsByTopic(
  topic: string,
  count: number = 5,
  difficulty: number = 3,
  type: string = "single"
): Promise<AiResponse> {
  const prompt = `
请为 "${topic}" 生成 ${count} 道${type === "single" ? "单选题" : type === "multiple" ? "多选题" : "题目"}，难度等级 ${difficulty}/5。

返回严格的 JSON 数组格式：
[
  {
    "content": "题目内容",
    "options": [{"key": "A", "value": "选项A"}, {"key": "B", "value": "选项B"}, {"key": "C", "value": "选项C"}, {"key": "D", "value": "选项D"}],
    "answer": "${type === "single" ? "A" : "A,B"}",
    "analysis": "解析"
  }
]
`;

  return askAi(prompt, "你是出题专家，请以中文出题，严格返回 JSON 数组格式。确保 JSON 有效可解析。");
}
