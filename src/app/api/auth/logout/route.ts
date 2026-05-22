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

    await prisma.userSession.update({
      where: { id: payload.sessionId },
      data: { isActive: false },
    });

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
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
