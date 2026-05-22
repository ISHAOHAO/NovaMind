import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getOnlineUsers } from "@/server/websocket";

export async function GET(req: NextRequest) {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      return Response.json({ error: "无权限" }, { status: 403 });
    }

    const onlineUsers = await getOnlineUsers();

    return Response.json({
      status: "running",
      connectedUsers: onlineUsers.length,
      onlineUserIds: onlineUsers,
    });
  } catch (error) {
    console.error("获取 WebSocket 状态失败:", error);
    return Response.json(
      { error: "获取状态失败，请稍后重试" },
      { status: 500 }
    );
  }
}
