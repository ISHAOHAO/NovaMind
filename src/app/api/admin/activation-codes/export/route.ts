import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId") || undefined;
    const status = searchParams.get("status") || undefined;

    const where: Prisma.ActivationCodeWhereInput = {};

    if (batchId) {
      where.batchId = batchId;
    }
    if (status) {
      where.status = status as any;
    }

    const codes = await prisma.activationCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        code: true,
        prefix: true,
        batchId: true,
        duration: true,
        status: true,
        isUsed: true,
        usedAt: true,
        expiresAt: true,
        createdAt: true,
        usedBy: {
          select: {
            email: true,
          },
        },
      },
    });

    const headers = [
      "激活码",
      "前缀",
      "批次ID",
      "有效期(天)",
      "状态",
      "是否已使用",
      "使用者邮箱",
      "使用时间",
      "过期时间",
      "创建时间",
    ];

    let csv = headers.map(escapeCsvField).join(",") + "\r\n";

    for (const code of codes) {
      const row = [
        code.code,
        code.prefix,
        code.batchId,
        String(code.duration),
        code.status,
        code.isUsed ? "是" : "否",
        code.usedBy?.email || "",
        code.usedAt ? new Date(code.usedAt).toISOString() : "",
        code.expiresAt ? new Date(code.expiresAt).toISOString() : "",
        code.createdAt ? new Date(code.createdAt).toISOString() : "",
      ];
      csv += row.map(escapeCsvField).join(",") + "\r\n";
    }

    const bom = "\uFEFF";
    const content = bom + csv;

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="activation-codes-${batchId || "all"}-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("导出激活码失败:", error);
    return Response.json({ error: "导出激活码失败" }, { status: 500 });
  }
});
