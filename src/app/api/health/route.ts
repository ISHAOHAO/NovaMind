import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

export async function GET() {
  const details: Record<string, { status: string; message?: string }> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    details.database = { status: "healthy" };
  } catch (error) {
    details.database = {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "数据库连接失败",
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
      message: error instanceof Error ? error.message : "Redis 连接失败",
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
