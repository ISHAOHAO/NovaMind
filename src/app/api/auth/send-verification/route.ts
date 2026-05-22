import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { authenticateRequest } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true },
    });

    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    await redis.setex(`verify_code:${payload.userId}`, 600, code);

    await sendVerificationEmail(user.email, code);

    return Response.json({ message: "验证码已发送至您的邮箱" });
  } catch (error) {
    console.error("发送验证码失败:", error);
    return Response.json(
      { error: "发送验证码失败，请稍后重试" },
      { status: 500 }
    );
  }
}
