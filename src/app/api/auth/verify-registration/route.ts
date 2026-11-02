import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { signToken } from "@/lib/auth";
import { getDeviceFingerprint, getUserAgent } from "@/lib/device";

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_S = 1800;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || typeof email !== "string") {
      return Response.json({ error: "请输入邮箱" }, { status: 400 });
    }

    if (!code || typeof code !== "string" || !code.trim()) {
      return Response.json({ error: "请输入验证码" }, { status: 400 });
    }

    const cleanCode = code.trim();

    const attemptKey = `reg_verify_attempts:${email}`;
    const attempts = parseInt((await redis.get(attemptKey)) || "0", 10);
    if (attempts >= MAX_ATTEMPTS) {
      const ttl = await redis.ttl(attemptKey);
      const minutes = Math.ceil(ttl / 60);
      return Response.json(
        { error: `验证码尝试次数过多，请${minutes}分钟后再试` },
        { status: 429 }
      );
    }

    const key = `reg_verify:${email}`;
    const storedCode = await redis.get(key);

    if (!storedCode) {
      return Response.json(
        { error: "验证码已过期，请重新获取" },
        { status: 400 }
      );
    }

    if (storedCode !== cleanCode) {
      await redis
        .multi()
        .incr(attemptKey)
        .expire(attemptKey, ATTEMPT_WINDOW_S)
        .exec();
      const remaining = MAX_ATTEMPTS - attempts - 1;
      return Response.json(
        { error: `验证码错误，还剩${remaining}次尝试机会` },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }

    if (user.emailVerified) {
      await redis.del(key);
      return Response.json({ message: "邮箱已验证，请直接登录" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "VERIFY_EMAIL",
        details: "用户通过注册验证码完成邮箱验证",
      },
    });

    await redis.del(key);
    await redis.del(attemptKey);

    // 验证成功后直接签发会话，前端可自动登录，免去重复输入账密
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = getUserAgent(req);
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        deviceId: getDeviceFingerprint(req) || "unknown",
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    await prisma.userSession.update({
      where: { id: session.id },
      data: { token },
    });

    return Response.json({
      message: "邮箱验证成功",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        isActivated: user.isActivated,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error("注册验证失败:", error);
    return Response.json(
      { error: "验证失败，请稍后重试" },
      { status: 500 }
    );
  }
}
