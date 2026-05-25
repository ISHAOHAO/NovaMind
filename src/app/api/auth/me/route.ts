import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        isActivated: true,
        emailVerified: true,
        activatedAt: true,
        banned: true,
        bannedReason: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }

    return Response.json({ user });
  } catch (error) {
    console.error("获取用户信息失败:", error);
    return Response.json(
      { error: "获取用户信息失败" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const body = await req.json();
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, avatar } = validation.data;

    const updateData: Record<string, unknown> = { name };
    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        isActivated: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ message: "更新成功", user });
  } catch (error) {
    console.error("更新用户信息失败:", error);
    return Response.json(
      { error: "更新失败，请稍后重试" },
      { status: 500 }
    );
  }
}
