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
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || undefined;
    const banned = searchParams.get("banned");
    const isActivated = searchParams.get("isActivated");
    const emailVerified = searchParams.get("emailVerified");

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) {
      where.role = role as any;
    }
    if (banned === "true" || banned === "false") {
      where.banned = banned === "true";
    }
    if (isActivated === "true" || isActivated === "false") {
      where.isActivated = isActivated === "true";
    }
    if (emailVerified === "true" || emailVerified === "false") {
      where.emailVerified = emailVerified === "true";
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        isActivated: true,
        emailVerified: true,
        banned: true,
        createdAt: true,
      },
    });

    const roleLabels: Record<string, string> = {
      USER: "用户",
      ADMIN: "管理员",
      SUPER_ADMIN: "超级管理员",
    };

    const headers = [
      "ID",
      "邮箱",
      "用户名",
      "角色",
      "激活状态",
      "邮箱验证",
      "封禁状态",
      "注册时间",
    ];

    let csv = headers.map(escapeCsvField).join(",") + "\r\n";

    for (const user of users) {
      const row = [
        user.id,
        user.email,
        user.username || "",
        roleLabels[user.role] || user.role,
        user.isActivated ? "已激活" : "未激活",
        user.emailVerified ? "已验证" : "未验证",
        user.banned ? "已封禁" : "正常",
        user.createdAt ? new Date(user.createdAt).toISOString() : "",
      ];
      csv += row.map(escapeCsvField).join(",") + "\r\n";
    }

    const bom = "\uFEFF";
    const content = bom + csv;

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("导出用户失败:", error);
    return Response.json({ error: "导出用户失败" }, { status: 500 });
  }
});
