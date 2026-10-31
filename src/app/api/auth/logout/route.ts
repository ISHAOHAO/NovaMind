import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { authenticateRequest, getTokenFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    await prisma.userSession.update({
      where: { id: payload.sessionId },
      data: { isActive: false },
    });

    // 无论令牌来自 Authorization 头还是 Cookie，都加入黑名单使其立即失效
    const token = getTokenFromRequest(req);
    if (token) {
      await redis.setex(
        `blacklist:token:${token}`,
        7 * 24 * 60 * 60,
        "1"
      );
    }

    return Response.json({ message: "已退出登录" });
  } catch (error) {
    console.error("退出登录失败:", error);
    return Response.json(
      { error: "退出登录失败" },
      { status: 500 }
    );
  }
}
