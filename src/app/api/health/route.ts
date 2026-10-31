import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

const isProd = process.env.NODE_ENV === "production";

function errorMessage(error: unknown): string | undefined {
  // 生产环境不对外暴露底层错误细节（可能包含连接串、主机名等）
  if (!isProd) {
    return error instanceof Error ? error.message : "连接失败";
  }
  return undefined;
}

export async function GET() {
  const details: Record<string, { status: string; message?: string }> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    details.database = { status: "healthy" };
  } catch (error) {
    details.database = {
      status: "unhealthy",
      message: errorMessage(error),
    };
  }

  try {
    const pong = await redis.ping();
    if (pong === "PONG") {
      details.redis = { status: "healthy" };
    } else {
      details.redis = {
        status: "unhealthy",
        message: "Redis 返回异常响应",
      };
    }
  } catch (error) {
    details.redis = {
      status: "unhealthy",
      message: errorMessage(error),
    };
  }

  const allHealthy = Object.values(details).every((d) => d.status === "healthy");

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "unhealthy",
      details,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 }
  );
}
