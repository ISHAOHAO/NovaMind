import { NextRequest } from "next/server";
import { requireAdmin, TokenPayload } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";

const VALID_ROLES: UserRole[] = ["USER", "ADMIN", "SUPER_ADMIN"];

export const GET = requireAdmin(async (req: NextRequest, { params }: { params: Promise<{ userId: string }> }) => {
  try {
    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isActivated: true,
        activatedAt: true,
        banned: true,
        bannedReason: true,
        bannedAt: true,
        deletedAt: true,
        lastLoginAt: true,
        lastLoginIp: true,
        deviceId: true,
        todayUsedSeconds: true,
        lastUsedDate: true,
        createdAt: true,
        updatedAt: true,
        activationCode: {
          select: {
            code: true,
            status: true,
            usedAt: true,
            expiresAt: true,
          },
        },
        _count: {
          select: {
            uploads: true,
            records: true,
            favorites: true,
            notes: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }

    return Response.json({ user });
  } catch (error) {
    console.error("获取用户详情失败:", error);
    return Response.json({ error: "获取用户详情失败" }, { status: 500 });
  }
});

export const PUT = requireAdmin(async (req: NextRequest, { params }: { params: Promise<{ userId: string }> }) => {
  try {
    const { userId } = await params;
    const currentUser = (req as any).user as TokenPayload;

    const body = await req.json();
    const updateData: any = {};
    const actions: string[] = [];

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, banned: true, role: true },
    });

    if (!existingUser) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }

    if (userId === currentUser.userId && body.role && body.role !== existingUser.role) {
      return Response.json({ error: "不能修改自己的角色" }, { status: 400 });
    }

    if (typeof body.banned === "boolean") {
      if (body.banned) {
        if (!body.bannedReason || typeof body.bannedReason !== "string" || body.bannedReason.trim().length === 0) {
          return Response.json({ error: "请填写封禁原因" }, { status: 400 });
        }
        if (body.bannedReason.length > 500) {
          return Response.json({ error: "封禁原因不能超过 500 个字符" }, { status: 400 });
        }
        updateData.banned = true;
        updateData.bannedReason = body.bannedReason.trim();
        updateData.bannedAt = new Date();
        actions.push(`封禁用户: ${body.bannedReason.trim()}`);
      } else {
        updateData.banned = false;
        updateData.bannedReason = null;
        updateData.bannedAt = null;
        actions.push("解除封禁");
      }
    }

    if (typeof body.isActivated === "boolean") {
      updateData.isActivated = body.isActivated;
      if (body.isActivated) {
        updateData.activatedAt = new Date();
        actions.push("强制激活账号");
      } else {
        updateData.activatedAt = null;
        actions.push("取消激活状态");
      }
    }

    if (body.role && typeof body.role === "string") {
      if (!VALID_ROLES.includes(body.role)) {
        return Response.json({ error: "无效的角色类型" }, { status: 400 });
      }

      if (body.role === "SUPER_ADMIN" && currentUser.role !== "SUPER_ADMIN") {
        return Response.json({ error: "仅超级管理员可设置超级管理员角色" }, { status: 403 });
      }

      updateData.role = body.role;
      actions.push(`修改角色为: ${body.role}`);
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "没有可更新的字段" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActivated: true,
        banned: true,
        bannedReason: true,
        bannedAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "UPDATE_USER",
        details: `管理用户 ${existingUser.email}: ${actions.join("; ")}`,
        ip: (req as any).clientIp || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    return Response.json({ user, message: "用户信息已更新" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "请求格式错误" }, { status: 400 });
    }
    console.error("更新用户失败:", error);
    return Response.json({ error: "更新用户失败" }, { status: 500 });
  }
});

export const DELETE = requireAdmin(async (req: NextRequest, { params }: { params: Promise<{ userId: string }> }) => {
  try {
    const currentUser = (req as any).user as TokenPayload;

    if (currentUser.role !== "SUPER_ADMIN") {
      return Response.json({ error: "仅超级管理员可删除用户" }, { status: 403 });
    }

    const { userId } = await params;

    if (currentUser.userId === userId) {
      return Response.json({ error: "不能删除自己的账号" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, deletedAt: true },
    });

    if (!existingUser) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }

    if (existingUser.deletedAt) {
      return Response.json({ error: "用户已被删除" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "DELETE_USER",
        details: `删除用户: ${existingUser.email}`,
        ip: (req as any).clientIp || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    return Response.json({ message: "用户已删除" });
  } catch (error) {
    console.error("删除用户失败:", error);
    return Response.json({ error: "删除用户失败" }, { status: 500 });
  }
});
