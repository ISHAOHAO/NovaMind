import { NextRequest, NextResponse } from "next/server";

/**
 * 路由级服务端守卫：仅检查会话 cookie 是否存在（真实鉴权仍在 API 层）。
 * 未登录访问受保护页面时直接重定向到 /login 并携带回跳地址，
 * 避免客户端先闪加载屏再丢失目标页面。
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/questions",
  "/exams",
  "/notes",
  "/analytics",
  "/profile",
  "/favorites",
  "/admin",
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("novamind_token")?.value);

  // 已登录用户访问登录/注册页时回到首页
  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/dashboard/:path*",
    "/questions/:path*",
    "/exams/:path*",
    "/notes/:path*",
    "/analytics/:path*",
    "/profile/:path*",
    "/favorites/:path*",
    "/admin/:path*",
  ],
};
