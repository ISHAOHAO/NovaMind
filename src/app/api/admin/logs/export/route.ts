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
    const userId = searchParams.get("userId") || undefined;
    const action = searchParams.get("action") || undefined;
    const search = searchParams.get("search") || "";
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const where: Prisma.AuditLogWhereInput = {};

    if (userId) {
      where.userId = userId;
    }
    if (action) {
      where.action = action;
    }
    if (search) {
      where.details = { contains: search, mode: "insensitive" };
    }
    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        where.createdAt.lte = new Date(to);
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        action: true,
        details: true,
        ip: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const headers = ["时间", "操作者", "动作", "详情", "IP"];

    let csv = headers.map(escapeCsvField).join(",") + "\r\n";

    for (const log of logs) {
      const operator = log.user
        ? `${log.user.name || ""}(${log.user.email})`
        : "系统";
      const row = [
        log.createdAt ? new Date(log.createdAt).toISOString() : "",
        operator,
        log.action,
        log.details || "",
        log.ip || "",
      ];
      csv += row.map(escapeCsvField).join(",") + "\r\n";
    }

    const bom = "\uFEFF";
    const content = bom + csv;

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="operation-logs-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("导出操作日志失败:", error);
    return Response.json({ error: "导出操作日志失败" }, { status: 500 });
  }
});
