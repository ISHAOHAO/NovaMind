import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/register`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/questions`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const banks = await prisma.questionBank.findMany({
      where: { isPublic: true, status: "APPROVED" },
      select: { id: true, updatedAt: true },
      take: 2000,
      orderBy: { updatedAt: "desc" },
    });
    return [
      ...staticEntries,
      ...banks.map((b) => ({
        url: `${baseUrl}/questions/${b.id}`,
        lastModified: b.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return staticEntries;
  }
}
