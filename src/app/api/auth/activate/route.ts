import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

const MAX_ATTEMPTS = 20;
const BLOCK_DURATION_MS = 15 * 60 * 1000;
const RATE_LIMIT_KEY_PREFIX = "activate:ip:";

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; message?: string }> {
  const key = `${RATE_LIMIT_KEY_PREFIX}${ip}`;
  const now = new Date();

  const record = await prisma.rateLimit.findUnique({ where: { key } });

  if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
    const remainingSeconds = Math.ceil((record.resetAt.getTime() - now.getTime()) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    return {
      allowed: false,
      message: `尝试次数过多，请 ${remainingMinutes} 分钟后再试`,
    };
  }

  return { allowed: true };
}

async function recordFailedAttempt(ip: string): Promise<void> {
  const key = `${RATE_LIMIT_KEY_PREFIX}${ip}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + BLOCK_DURATION_MS);

  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (existing) {
    const isExpired = existing.resetAt <= now;
    await prisma.rateLimit.update({
      where: { key },
      data: {
        count: isExpired ? 1 : existing.count + 1,
        resetAt: isExpired ? resetAt : existing.resetAt,
      },
    });
  } else {
    await prisma.rateLimit.create({
      data: {
        key,
        count: 1,
        resetAt,
      },
    });
  }
}

async function clearRateLimit(ip: string): Promise<void> {
  const key = `${RATE_LIMIT_KEY_PREFIX}${ip}`;
  await prisma.rateLimit.deleteMany({ where: { key } });
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "127.0.0.1";
}

export async function POST(req: NextRequest) {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const clientIp = getClientIp(req);

    const rateCheck = await checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return Response.json({ error: rateCheck.message }, { status: 429 });
    }

    const body = await req.json();
    const rawCode = body.code;

    if (!rawCode || typeof rawCode !== "string" || !rawCode.trim()) {
      return Response.json({ error: "请输入激活码" }, { status: 400 });
    }

    const code = rawCode.trim().toUpperCase();

    const activationCode = await prisma.activationCode.findUnique({
      where: { code },
    });

    if (!activationCode) {
      await recordFailedAttempt(clientIp);
      return Response.json({ error: "激活码无效" }, { status: 400 });
    }

    if (activationCode.isUsed) {
      return Response.json({ error: "该激活码已被使用" }, { status: 400 });
    }

    if (activationCode.status === "EXPIRED") {
      return Response.json({ error: "激活码已过期" }, { status: 400 });
    }

    if (
      activationCode.expiresAt &&
      new Date() > new Date(activationCode.expiresAt)
    ) {
      await prisma.activationCode.update({
        where: { id: activationCode.id },
        data: { status: "EXPIRED" },
      });
      return Response.json({ error: "激活码已过期" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.activationCode.update({
        where: { id: activationCode.id },
        data: {
          isUsed: true,
          usedById: payload.userId,
          usedAt: new Date(),
          status: "USED",
        },
      }),
      prisma.user.update({
        where: { id: payload.userId },
        data: {
          isActivated: true,
          activatedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: payload.userId,
          action: "ACTIVATE_ACCOUNT",
          details: `用户使用激活码 ${code} 激活账号`,
        },
      }),
    ]);

    await clearRateLimit(clientIp);

    return Response.json({ message: "账号激活成功" });
  } catch (error) {
    console.error("激活失败:", error);
    return Response.json(
      { error: "激活失败，请稍后重试" },
      { status: 500 }
    );
  }
}
