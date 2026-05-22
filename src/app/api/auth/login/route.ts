import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, getDeviceFingerprint, getUserAgent } from "@/lib/device";
import { getSystemConfig } from "@/lib/config";
import { loginSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    const ip = getClientIp(req);
    const { allowed } = await rateLimit(`login:${ip}`, {
      maxRequests: 10,
      windowMs: 900000,
    });
    if (!allowed) {
      return Response.json(
        { error: "登录尝试过于频繁，请15分钟后再试" },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return Response.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    if (user.banned) {
      return Response.json(
        { error: `账号已被封禁${user.bannedReason ? `：${user.bannedReason}` : ""}` },
        { status: 403 }
      );
    }

    if (user.deletedAt) {
      return Response.json({ error: "该账号已注销" }, { status: 403 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return Response.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    const singleDeviceEnabled = await getSystemConfig(
      "single_device_login",
      "false"
    );
    if (singleDeviceEnabled === "true") {
      await prisma.userSession.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      });
    }

    const deviceId = getDeviceFingerprint(req);
    const userAgent = getUserAgent(req);

    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        deviceId: deviceId || "unknown",
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        deviceId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        details: `用户 ${user.email} 登录成功`,
        ip,
        userAgent,
      },
    });

    return Response.json({
      message: "登录成功",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        isActivated: user.isActivated,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("登录失败:", error);
    return Response.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
