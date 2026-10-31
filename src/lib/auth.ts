import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

const isProd = process.env.NODE_ENV === "production";

/**
 * JWT 签名密钥。生产环境必须显式设置 JWT_SECRET（Docker 部署由
 * docker-entrypoint.sh 自动生成）；为避免破坏构建流程，这里不在
 * 模块加载时抛错，而是在签发/校验令牌时惰性检查。
 */
const FALLBACK_SECRET = "novamind-jwt-secret-change-in-production";
let warnedWeakSecret = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 0) return secret;

  if (isProd) {
    throw new Error(
      "生产环境必须设置 JWT_SECRET 环境变量（可参考 docker-entrypoint.sh 自动生成）"
    );
  }
  if (!warnedWeakSecret) {
    warnedWeakSecret = true;
    console.warn(
      "[auth] 未设置 JWT_SECRET，正在使用不安全的开发默认值——切勿在生产环境使用"
    );
  }
  return FALLBACK_SECRET;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export function signToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  const cookieToken = req.cookies.get("novamind_token")?.value;
  if (cookieToken) return cookieToken;

  return null;
}

export function getTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

/** 登出后的令牌是否已被吊销 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const result = await redis.get(`blacklist:token:${token}`);
    return result === "1";
  } catch {
    // Redis 故障时放行，避免整站不可用（会话状态仍由数据库兜底校验）
    return false;
  }
}

/**
 * 校验令牌并确认其会话仍然有效：
 * - 令牌未被登出拉黑；
 * - 会话存在且处于激活状态、未过期；
 * - 用户存在、未被封禁、未注销。
 * 返回的 payload 中 role 以数据库当前值为准，角色变更即时生效。
 */
export async function validateTokenWithSession(
  token: string
): Promise<TokenPayload | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  if (await isTokenBlacklisted(token)) return null;

  const session = await prisma.userSession.findUnique({
    where: { id: payload.sessionId },
    select: {
      isActive: true,
      expiresAt: true,
      user: {
        select: { id: true, role: true, banned: true, deletedAt: true },
      },
    },
  });

  if (!session || !session.isActive) return null;
  if (new Date(session.expiresAt) < new Date()) return null;

  const user = session.user;
  if (!user || user.banned || user.deletedAt) return null;

  return {
    userId: user.id,
    email: payload.email,
    role: user.role,
    sessionId: payload.sessionId,
  };
}

export async function authenticateRequest(
  req: NextRequest
): Promise<TokenPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  return validateTokenWithSession(token);
}

export function requireAuth(handler: Function) {
  return async function (req: NextRequest, context?: any) {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "登录已过期，请重新登录" }, { status: 401 });
    }
    (req as any).user = user;
    return handler(req, context);
  };
}

export function requireAdmin(handler: Function) {
  return async function (req: NextRequest, context?: any) {
    const payload = await authenticateRequest(req);
    if (!payload) {
      return Response.json({ error: "登录已过期，请重新登录" }, { status: 401 });
    }

    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      return Response.json({ error: "无权限" }, { status: 403 });
    }

    (req as any).user = payload;
    return handler(req, context);
  };
}
