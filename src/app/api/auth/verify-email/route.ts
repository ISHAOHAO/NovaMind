import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { authenticateRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const body = await req.json();
    const rawCode = body.code;

    if (!rawCode || typeof rawCode !== "string" || !rawCode.trim()) {
      return Response.json({ error: "请输入验证码" }, { status: 400 });
    }

    const code = rawCode.trim();

    const key = `verify_code:${payload.userId}`;
    const storedCode = await redis.get(key);

    if (!storedCode) {
      return Response.json(
        { error: "验证码已过期，请重新获取" },
        { status: 400 }
      );
    }

    if (storedCode !== code) {
      return Response.json({ error: "验证码错误" }, { status: 400 });
    }

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: "VERIFY_EMAIL",
        details: "用户完成邮箱验证",
      },
    });

    await redis.del(key);

    return Response.json({ message: "邮箱验证成功" });
  } catch (error) {
    console.error("邮箱验证失败:", error);
    return Response.json(
      { error: "验证失败，请稍后重试" },
      { status: 500 }
    );
  }
}
