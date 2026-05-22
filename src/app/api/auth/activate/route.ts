import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
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
      return Response.json({ error: "请输入激活码" }, { status: 400 });
    }

    const code = rawCode.trim().toUpperCase();

    const activationCode = await prisma.activationCode.findUnique({
      where: { code },
    });

    if (!activationCode) {
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

    return Response.json({ message: "账号激活成功" });
  } catch (error) {
    console.error("激活失败:", error);
    return Response.json(
      { error: "激活失败，请稍后重试" },
      { status: 500 }
    );
  }
}
