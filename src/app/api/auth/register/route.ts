import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { rateLimit, checkRegistrationLimit } from "@/lib/rate-limit";
import { getClientIp, getDeviceFingerprint } from "@/lib/device";
import { getSystemConfig } from "@/lib/config";
import { registerSchema } from "@/lib/validations";

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

    const { email, password, name } = validation.data;

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

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return Response.json({ error: "该邮箱已被注册" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActivated: true,
        createdAt: true,
      },
    });

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
