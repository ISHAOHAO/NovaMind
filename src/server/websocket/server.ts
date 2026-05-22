import { WebSocketServer, WebSocket, RawData } from "ws";
import { randomUUID } from "crypto";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getSystemConfig } from "@/lib/config";

const AUTH_TIMEOUT = 10000;
const HEARTBEAT_INTERVAL = 10000;

interface ClientInfo {
  ws: WebSocket;
  userId: string;
  sessionId: string;
  connectedAt: number;
}

const clients = new Map<string, ClientInfo>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function cleanupUserConnection(userId: string, clientId: string) {
  try {
    const storedId = await redis.get(`ws:user:${userId}`);
    if (storedId === clientId) {
      await redis.del(`ws:user:${userId}`);
    }
    await redis.del(`ws:online:${userId}`);
    await redis.del(`ws:heartbeat:${userId}`);

    await prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    console.log(`用户 ${userId} 已断开连接`);
  } catch (err) {
    console.error(`清理用户连接失败 (${userId}):`, err);
  }
}

export function startWebSocketServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  console.log(`WebSocket 服务器已在端口 ${port} 启动`);

  wss.on("connection", (ws) => {
    const clientId = randomUUID();
    let authenticated = false;
    let userId: string | null = null;
    let sessionId: string | null = null;

    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        try {
          ws.send(
            JSON.stringify({ type: "auth_error", message: "认证超时，请在10秒内完成认证" })
          );
          ws.close(4001, "认证超时");
        } catch {
          // ignore
        }
      }
    }, AUTH_TIMEOUT);

    ws.on("message", async (raw: RawData) => {
      let msg: { type: string; [key: string]: unknown };

      try {
        msg = JSON.parse(raw.toString());
      } catch {
        try {
          ws.send(JSON.stringify({ type: "error", message: "消息格式错误" }));
        } catch {
          // ignore
        }
        return;
      }

      try {
        if (msg.type === "auth") {
          const token = msg.token as string;
          if (!token) {
            ws.send(JSON.stringify({ type: "auth_error", message: "缺少认证令牌" }));
            ws.close(4001, "缺少认证令牌");
            return;
          }

          const payload = verifyToken(token);
          if (!payload) {
            ws.send(JSON.stringify({ type: "auth_error", message: "令牌无效或已过期" }));
            ws.close(4001, "令牌无效");
            return;
          }

          authenticated = true;
          userId = payload.userId;
          sessionId = payload.sessionId;
          clearTimeout(authTimeout);

          const existingClientId = await redis.get(`ws:user:${userId}`);
          if (existingClientId) {
            const existingClient = clients.get(existingClientId);
            if (existingClient && existingClient.ws.readyState === WebSocket.OPEN) {
              try {
                existingClient.ws.send(
                  JSON.stringify({
                    type: "force_logout",
                    message: "您的账号在其他设备登录，已被强制下线",
                  })
                );
                existingClient.ws.close(4001, "其他设备登录");
              } catch {
                // ignore
              }
            }
            clients.delete(existingClientId);
          }

          await redis.set(`ws:user:${userId}`, clientId);
          await redis.set(`ws:online:${userId}`, String(Date.now()));
          await redis.set(`ws:heartbeat:${userId}`, String(Date.now()));

          clients.set(clientId, {
            ws,
            userId,
            sessionId,
            connectedAt: Date.now(),
          });

          if (sessionId) {
            await prisma.userSession.updateMany({
              where: { id: sessionId },
              data: { isActive: true, lastPingAt: new Date() },
            });
          }

          ws.send(JSON.stringify({ type: "auth_ok", userId }));
          console.log(`用户 ${userId} 已通过 WebSocket 认证`);
          return;
        }

        if (!authenticated) {
          ws.send(JSON.stringify({ type: "auth_error", message: "请先完成认证" }));
          return;
        }

        switch (msg.type) {
          case "ping": {
            const now = Date.now();
            await redis.set(`ws:heartbeat:${userId}`, String(now));
            ws.send(JSON.stringify({ type: "pong" }));

            if (sessionId) {
              await prisma.userSession.updateMany({
                where: { id: sessionId },
                data: { lastPingAt: new Date() },
              });
            }
            break;
          }

          default:
            ws.send(JSON.stringify({ type: "error", message: `未知消息类型: ${msg.type}` }));
        }
      } catch (err) {
        console.error(`消息处理错误 (${userId || clientId}):`, err);
        try {
          ws.send(JSON.stringify({ type: "error", message: "服务器内部错误" }));
        } catch {
          // ignore
        }
      }
    });

    ws.on("close", async () => {
      clearTimeout(authTimeout);
      if (authenticated && userId) {
        await cleanupUserConnection(userId, clientId);
      }
      clients.delete(clientId);
    });

    ws.on("error", async () => {
      clearTimeout(authTimeout);
      if (authenticated && userId) {
        await cleanupUserConnection(userId, clientId);
      }
      clients.delete(clientId);
    });
  });

  wss.on("error", (err) => {
    console.error("WebSocket 服务器错误:", err);
  });

  heartbeatTimer = setInterval(async () => {
    try {
      const timeoutSecondsStr = await getSystemConfig("ws_heartbeat_timeout", "90");
      const timeoutSeconds = parseInt(timeoutSecondsStr, 10) || 90;
      const now = Date.now();

      for (const [clientId, info] of clients) {
        try {
          const lastHeartbeat = await redis.get(`ws:heartbeat:${info.userId}`);
          if (!lastHeartbeat || now - parseInt(lastHeartbeat, 10) > timeoutSeconds * 1000) {
            console.log(`用户 ${info.userId} 心跳超时，断开连接`);

            if (info.ws.readyState === WebSocket.OPEN) {
              try {
                info.ws.send(
                  JSON.stringify({
                    type: "force_logout",
                    message: "连接超时，请重新登录",
                  })
                );
                info.ws.close(4001, "心跳超时");
              } catch {
                // ignore
              }
            }

            await cleanupUserConnection(info.userId, clientId);
            clients.delete(clientId);
          }
        } catch (err) {
          console.error(`心跳检查失败 (${info.userId}):`, err);
        }
      }
    } catch (err) {
      console.error("心跳检查器错误:", err);
    }
  }, HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });

  return wss;
}

export async function kickUser(userId: string): Promise<void> {
  try {
    const clientId = await redis.get(`ws:user:${userId}`);
    if (!clientId) return;

    const client = clients.get(clientId);
    if (client) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(
            JSON.stringify({
              type: "force_logout",
              message: "您的账号在其他设备登录，已被强制下线",
            })
          );
          client.ws.close(4001, "强制下线");
        } catch {
          // ignore
        }
      }
      await cleanupUserConnection(userId, clientId);
      clients.delete(clientId);
    }
  } catch (err) {
    console.error(`踢出用户失败 (${userId}):`, err);
  }
}

export async function isUserOnline(userId: string): Promise<boolean> {
  try {
    const exists = await redis.exists(`ws:online:${userId}`);
    return exists === 1;
  } catch {
    return false;
  }
}

export async function getOnlineUsers(): Promise<string[]> {
  try {
    const keys = await redis.keys("ws:online:*");
    return keys.map((k) => k.replace("ws:online:", ""));
  } catch {
    return [];
  }
}
