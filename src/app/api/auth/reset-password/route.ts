import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "novamind-jwt-secret-change-in-production";

interface ResetTokenPayload {
  userId: string;
  email: string;
  purpose: string;
  iat?: number;
  exp?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "缺少重置令牌" }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ error: "请输入新密码" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "密码至少需要 6 位字符" }, { status: 400 });
    }

    if (newPassword.length > 100) {
      return NextResponse.json({ error: "密码长度不能超过 100 位" }, { status: 400 });
    }

    let payload: ResetTokenPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as ResetTokenPayload;
    } catch {
      return NextResponse.json(
        { error: "重置链接已过期或无效，请重新申请" },
        { status: 400 }
      );
    }

    if (payload.purpose !== "password_reset") {
      return NextResponse.json({ error: "无效的重置令牌" }, { status: 400 });
    }

    const storedToken = await redis.get(`pwd_reset:${payload.userId}`);
    if (!storedToken || storedToken !== token) {
      return NextResponse.json(
        { error: "重置链接已过期或已被使用，请重新申请" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: payload.userId },
        data: { password: hashedPassword },
      }),
      prisma.userSession.updateMany({
        where: { userId: payload.userId, isActive: true },
        data: { isActive: false },
      }),
    ]);

    await redis.del(`pwd_reset:${payload.userId}`);

    return NextResponse.json({ message: "密码重置成功，请使用新密码登录" }, { status: 200 });
  } catch (error) {
    console.error("[Reset Password] Error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
