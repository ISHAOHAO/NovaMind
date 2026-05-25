import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/device";

const EMAIL_COOLDOWN_S = 60;
const ATTEMPT_WINDOW_S = 1800;
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return Response.json({ error: "请输入邮箱" }, { status: 400 });
    }

    const ip = getClientIp(req);
    const { allowed: ipAllowed } = await rateLimit(`resend_verify:${ip}`, {
      maxRequests: 3,
      windowMs: 600000,
    });
    if (!ipAllowed) {
      return Response.json(
        { error: "发送过于频繁，请10分钟后再试" },
        { status: 429 }
      );
    }

    const cooldownKey = `email_sent_cooldown:${email}`;
    const inCooldown = await redis.get(cooldownKey);
    if (inCooldown) {
      return Response.json(
        { error: `发送过于频繁，请${EMAIL_COOLDOWN_S}秒后再试` },
        { status: 429 }
      );
    }

    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) {
      return Response.json({ error: "该邮箱未注册" }, { status: 404 });
    }

    if (user.emailVerified) {
      return Response.json({ message: "该邮箱已验证，请直接登录" });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await redis.setex(`reg_verify:${email}`, 600, code);
    await redis.setex(cooldownKey, EMAIL_COOLDOWN_S, "1");
    const sent = await sendVerificationEmail(email, code);

    if (!sent) {
      await redis.del(`reg_verify:${email}`);
      await redis.del(cooldownKey);
      return Response.json(
        { error: "邮件发送失败，请确认邮件服务已配置" },
        { status: 500 }
      );
    }

    return Response.json({ message: "验证码已重新发送至您的邮箱" });
  } catch (error) {
    console.error("重新发送验证码失败:", error);
    return Response.json(
      { error: "发送失败，请稍后重试" },
      { status: 500 }
    );
  }
}
