/**
 * 客户端会话助手：统一 token/user 的写入、清除与登录跳转。
 * 除 localStorage 外同步维护一个非 httpOnly 的 novamind_token cookie，
 * 供 middleware 做服务端路由守卫（仅判断存在性，真实校验仍在 API 层）。
 */

export const SESSION_COOKIE = "novamind_token";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string | null;
  role: string;
  isActivated?: boolean;
  emailVerified?: boolean;
}

function writeSessionCookie(token: string) {
  const maxAge = 7 * 24 * 60 * 60; // 与 JWT 有效期一致
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(
    token
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function eraseSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function persistSession(token: string, user: SessionUser) {
  localStorage.setItem("novamind_token", token);
  localStorage.setItem("novamind_user", JSON.stringify(user));
  writeSessionCookie(token);
}

export function clearSession() {
  localStorage.removeItem("novamind_token");
  localStorage.removeItem("novamind_user");
  eraseSessionCookie();
}

/** 会话失效时清理并跳转登录页，携带回跳地址 */
export function redirectToLogin(reason?: "expired") {
  if (reason === "expired") {
    clearSession();
  }
  if (typeof window === "undefined") return;
  const current = window.location.pathname + window.location.search;
  const target = `/login?redirect=${encodeURIComponent(current)}`;
  window.location.replace(target);
}

/**
 * 带 401 拦截的 fetch：响应为 401 时清除本地会话并跳转登录页。
 * 学生端页面可逐步迁移到该封装；当前先在布局层做统一探活。
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = localStorage.getItem("novamind_token");
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    redirectToLogin("expired");
  }
  return res;
}
