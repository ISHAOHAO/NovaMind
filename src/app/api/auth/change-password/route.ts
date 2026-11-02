import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authenticateRequest } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/** 修改密码（需登录）：校验旧密码后更新，并吊销该用户所有现有会话 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
    }

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const { allowed } = await rateLimit(`change-password:${auth.userId}`, {
      windowMs: 60_000,
      maxRequests: 5,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "操作过于频繁，请 1 分钟后再试" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const oldPassword =
      typeof body.oldPassword === "string" ? body.oldPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "请填写所有密码字段" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "新密码至少需要 6 位字符" },
        { status: 400 }
      );
    }
    if (newPassword.length > 100) {
      return NextResponse.json(
        { error: "密码长度不能超过 100 位" },
        { status: 400 }
      );
    }
    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: "新密码不能与旧密码相同" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, password: true },
    });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "旧密码错误" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      // 吊销其他会话，仅保留当前会话
      prisma.userSession.updateMany({
        where: { userId: user.id, isActive: true, id: { not: auth.sessionId } },
        data: { isActive: false },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CHANGE_PASSWORD",
        details: "用户修改密码",
        ip,
      },
    });

    return NextResponse.json({ message: "密码修改成功" });
  } catch (error) {
    console.error("[Change Password] Error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
