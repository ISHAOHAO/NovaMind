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

    const cooldownKey = `verify_code_sent:${payload.userId}`;
    const inCooldown = await redis.get(cooldownKey);
    if (inCooldown) {
      return Response.json(
        { error: "发送过于频繁，请60秒后再试" },
        { status: 429 }
      );
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
    await redis.setex(cooldownKey, 60, "1");

    const sent = await sendVerificationEmail(user.email, code);

    if (!sent) {
      await redis.del(`verify_code:${payload.userId}`);
      await redis.del(cooldownKey);
      return Response.json(
        { error: "邮件发送失败，请确认邮件服务已配置" },
        { status: 500 }
      );
    }

    return Response.json({ message: "验证码已发送至您的邮箱" });
  } catch (error) {
    console.error("发送验证码失败:", error);
    return Response.json(
      { error: "发送验证码失败，请稍后重试" },
      { status: 500 }
    );
  }
}
