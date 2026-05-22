import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "novamind-jwt-secret-change-in-production";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export function signToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
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

export async function authenticateRequest(
  req: NextRequest
): Promise<TokenPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const payload = verifyToken(token);
  return payload;
}

export function requireAuth(handler: Function) {
  return async function (req: NextRequest, context?: any) {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }
    (req as any).user = user;
    return handler(req, context);
  };
}

export function requireAdmin(handler: Function) {
  return async function (req: NextRequest, context?: any) {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const payload = user as TokenPayload;
    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      return Response.json({ error: "无权限" }, { status: 403 });
    }

    (req as any).user = payload;
    return handler(req, context);
  };
}
