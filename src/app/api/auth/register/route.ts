import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { rateLimit, checkRegistrationLimit } from "@/lib/rate-limit";
import { getClientIp, getDeviceFingerprint } from "@/lib/device";
import { getSystemConfig } from "@/lib/config";
import { registerSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, username, password, name } = validation.data;

    const registerEnabled = await getSystemConfig("register_enabled", "true");
    if (registerEnabled !== "true") {
      return Response.json({ error: "注册功能暂未开放" }, { status: 403 });
    }

    const ip = getClientIp(req);
    const { allowed: ipRateAllowed } = await rateLimit(`register:${ip}`, {
      maxRequests: 10,
      windowMs: 3600000,
    });
    if (!ipRateAllowed) {
      return Response.json(
        { error: "注册请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const ipRegistrationAllowed = await checkRegistrationLimit(ip, "ip");
    if (!ipRegistrationAllowed) {
      return Response.json(
        { error: "该IP注册次数已达上限" },
        { status: 429 }
      );
    }

    const deviceId = getDeviceFingerprint(req);
    if (deviceId) {
      const deviceAllowed = await checkRegistrationLimit(deviceId, "device");
      if (!deviceAllowed) {
        return Response.json(
          { error: "该设备注册次数已达上限" },
          { status: 429 }
        );
      }
    }

    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (emailDomain) {
      const domainAllowed = await checkRegistrationLimit(
        emailDomain,
        "email_domain"
      );
      if (!domainAllowed) {
        return Response.json(
          { error: "该邮箱域名注册次数已达上限" },
          { status: 429 }
        );
      }

      const blockedDomainsStr = await getSystemConfig(
        "blocked_email_domains",
        ""
      );
      const blockedList = blockedDomainsStr
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      if (blockedList.includes(emailDomain)) {
        return Response.json(
          { error: "该邮箱域名已被禁止注册" },
          { status: 400 }
        );
      }
    }

    const emailVerificationRequired = await getSystemConfig(
      "email_verification_required",
      "false"
    );

    const existingUser = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existingUser) {
      if (emailVerificationRequired === "true" && !existingUser.emailVerified) {
        const cooldownKey = `email_sent_cooldown:${email}`;
        const inCooldown = await redis.get(cooldownKey);
        if (inCooldown) {
          return Response.json(
            { error: "验证码已发送，请60秒后再试" },
            { status: 429 }
          );
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        await redis.setex(`reg_verify:${email}`, 600, code);
        await redis.setex(cooldownKey, 60, "1");
        const sent = await sendVerificationEmail(email, code);

        if (!sent) {
          await redis.del(`reg_verify:${email}`);
          await redis.del(cooldownKey);
          return Response.json(
            { error: "验证邮件发送失败，请确认邮件服务已配置" },
            { status: 500 }
          );
        }

        return Response.json(
          { message: "该邮箱尚未验证，验证码已重新发送", needVerify: true },
          { status: 200 }
        );
      }
      return Response.json({ error: "该邮箱已被注册" }, { status: 409 });
    }

    const existingUsername = await prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
    if (existingUsername) {
      return Response.json({ error: "该用户名已被使用" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name,
        emailVerified: emailVerificationRequired !== "true",
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        isActivated: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (emailVerificationRequired === "true") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await redis.setex(`reg_verify:${email}`, 600, code);
      await redis.setex(`email_sent_cooldown:${email}`, 60, "1");
      const sent = await sendVerificationEmail(email, code);

      if (!sent) {
        await redis.del(`reg_verify:${email}`);
        await redis.del(`email_sent_cooldown:${email}`);
        return Response.json(
          { error: "验证邮件发送失败，请确认邮件服务已配置" },
          { status: 500 }
        );
      }

      return Response.json(
        { message: "注册成功，验证码已发送至您的邮箱，请验证后登录", user, needVerify: true },
        { status: 201 }
      );
    }

    return Response.json(
      { message: "注册成功", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("注册失败:", error);
    return Response.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}
