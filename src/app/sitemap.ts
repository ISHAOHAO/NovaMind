import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const revalidate = 3600;

/**
 * 全站受登录墙保护（middleware 将题库/练习页重定向到登录），
 * 不向匿名暴露任何题库 ID 枚举，sitemap 仅包含公开静态页。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/register`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
