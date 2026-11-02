import DOMPurify from "dompurify";

/**
 * 消毒 AI 返回的 HTML 片段：
 * 只保留文本与结构标签，剔除 script/style/事件属性与内联样式，
 * 样式统一交给 .ai-content 的 CSS 类控制（适配深浅色主题）。
 */
export function sanitizeAiHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["style", "script", "iframe", "form", "input"],
    FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
    ALLOWED_ATTR: ["class", "href", "target", "rel"],
  });
}
