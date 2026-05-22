import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import redis from "@/lib/redis";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "novamind-jwt-secret-change-in-production";
const RESET_TOKEN_EXPIRY = 1800;

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const { allowed } = await rateLimit(`forgot-password:${ip}`, {
      windowMs: 60000,
      maxRequests: 3,
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "请求过于频繁，请 1 分钟后再试" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { message: "如果该邮箱已注册，重置密码链接已发送" },
        { status: 200 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json(
        { message: "如果该邮箱已注册，重置密码链接已发送" },
        { status: 200 }
      );
    }

    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "30m" }
    );

    await redis.setex(`pwd_reset:${user.id}`, RESET_TOKEN_EXPIRY, resetToken);

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail(user.email, resetLink);

    return NextResponse.json(
      { message: "如果该邮箱已注册，重置密码链接已发送" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Forgot Password] Error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
