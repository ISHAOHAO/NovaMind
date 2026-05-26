"use client";

import toast from "react-hot-toast";

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  params?: Record<string, string | number | undefined>;
};

const BASE_PATH = "";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("novamind_token");
}

function clearAuthAndRedirect(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("novamind_token");
  localStorage.removeItem("novamind_user");
  window.location.href = "/login";
}

export async function apiFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body !== undefined && typeof options.body !== "string") {
    headers["Content-Type"] = "application/json";
  }

  let fullUrl = `${BASE_PATH}${url}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== "") {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) fullUrl += `?${qs}`;
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers,
    body:
      options.body !== undefined && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : (options.body as BodyInit | undefined),
  });

  if (res.status === 401) {
    clearAuthAndRedirect();
    throw new Error("登录已过期，请重新登录");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `请求失败 (${res.status})`);
  }

  return data;
}

export function handleApiError(error: unknown, fallback?: string): void {
  const message =
    error instanceof Error ? error.message : (fallback ?? "操作失败，请稍后重试");
  toast.error(message);
}

export function apiSuccess(message: string): void {
  toast.success(message);
}

export { getToken };
