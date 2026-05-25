export interface ProviderInfo {
  value: string
  label: string
  baseUrl: string
  models: { label: string; value: string }[]
}

export const AI_PROVIDERS: ProviderInfo[] = [
  {
    value: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { label: "GPT-4.1", value: "gpt-4.1" },
      { label: "GPT-4.1 Mini", value: "gpt-4.1-mini" },
      { label: "GPT-4o", value: "gpt-4o" },
      { label: "GPT-4o Mini", value: "gpt-4o-mini" },
      { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
      { label: "O3 Mini", value: "o3-mini" },
      { label: "O4 Mini", value: "o4-mini" },
    ],
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { label: "DeepSeek Chat (V3)", value: "deepseek-chat" },
      { label: "DeepSeek Reasoner (R1)", value: "deepseek-reasoner" },
    ],
  },
  {
    value: "zhipu",
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: [
      { label: "GLM-4 Plus", value: "glm-4-plus" },
      { label: "GLM-4 Air", value: "glm-4-air" },
      { label: "GLM-4 Flash", value: "glm-4-flash" },
      { label: "GLM-4 FlashX", value: "glm-4-flashx" },
      { label: "GLM-3 Turbo", value: "glm-3-turbo" },
    ],
  },
  {
    value: "qwen",
    label: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { label: "Qwen Max", value: "qwen-max" },
      { label: "Qwen Plus", value: "qwen-plus" },
      { label: "Qwen Turbo", value: "qwen-turbo" },
      { label: "Qwen3-235B-A22B", value: "qwen3-235b-a22b" },
    ],
  },
  {
    value: "moonshot",
    label: "月之暗面 (Kimi)",
    baseUrl: "https://api.moonshot.cn/v1",
    models: [
      { label: "Moonshot v1 8K", value: "moonshot-v1-8k" },
      { label: "Moonshot v1 32K", value: "moonshot-v1-32k" },
      { label: "Moonshot v1 128K", value: "moonshot-v1-128k" },
    ],
  },
  {
    value: "baichuan",
    label: "百川智能",
    baseUrl: "https://api.baichuan-ai.com/v1",
    models: [
      { label: "Baichuan4", value: "Baichuan4" },
      { label: "Baichuan3-Turbo", value: "Baichuan3-Turbo" },
      { label: "Baichuan4-Air", value: "Baichuan4-Air" },
    ],
  },
  {
    value: "minimax",
    label: "MiniMax",
    baseUrl: "https://api.minimax.chat/v1",
    models: [
      { label: "abab6.5s-chat", value: "abab6.5s-chat" },
      { label: "abab6.5-chat", value: "abab6.5-chat" },
    ],
  },
  {
    value: "lingyi",
    label: "零一万物",
    baseUrl: "https://api.lingyiwanwu.com/v1",
    models: [
      { label: "Yi Large", value: "yi-large" },
      { label: "Yi Medium", value: "yi-medium" },
      { label: "Yi Spark", value: "yi-spark" },
    ],
  },
  {
    value: "siliconflow",
    label: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: [
      { label: "DeepSeek-V3", value: "deepseek-ai/DeepSeek-V3" },
      { label: "DeepSeek-R1", value: "deepseek-ai/DeepSeek-R1" },
      { label: "Qwen2.5-72B", value: "Qwen/Qwen2.5-72B-Instruct" },
      { label: "Llama-3.3-70B", value: "meta-llama/Llama-3.3-70B-Instruct" },
    ],
  },
  {
    value: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      { label: "Llama 3.3 70B", value: "llama-3.3-70b-versatile" },
      { label: "Llama 3.1 8B", value: "llama-3.1-8b-instant" },
      { label: "DeepSeek R1 Distill 70B", value: "deepseek-r1-distill-llama-70b" },
    ],
  },
  {
    value: "mistral",
    label: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    models: [
      { label: "Mistral Large", value: "mistral-large-latest" },
      { label: "Mistral Medium", value: "mistral-medium-latest" },
      { label: "Mistral Small", value: "mistral-small-latest" },
    ],
  },
  {
    value: "xai",
    label: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    models: [
      { label: "Grok-2", value: "grok-2-1212" },
    ],
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      { label: "OpenAI GPT-4o", value: "openai/gpt-4o" },
      { label: "Anthropic Claude 3.5 Sonnet", value: "anthropic/claude-3.5-sonnet" },
      { label: "Google Gemini 2.0 Flash", value: "google/gemini-2.0-flash-001" },
      { label: "Meta Llama 3.3 70B", value: "meta-llama/llama-3.3-70b-instruct" },
    ],
  },
  {
    value: "bytedance",
    label: "字节豆包",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: [
      { label: "Doubao Pro 32K", value: "doubao-pro-32k" },
      { label: "Doubao Lite 32K", value: "doubao-lite-32k" },
    ],
  },
  {
    value: "custom",
    label: "自定义",
    baseUrl: "",
    models: [],
  },
]

export const CUSTOM_PROVIDER_VALUE = "custom"
export const CUSTOM_MODEL_VALUE = "__custom__"

export function getProviderByValue(value: string): ProviderInfo | undefined {
  return AI_PROVIDERS.find((p) => p.value === value)
}

export function getProviderOptions() {
  return AI_PROVIDERS.map((p) => ({ label: p.label, value: p.value }))
}
