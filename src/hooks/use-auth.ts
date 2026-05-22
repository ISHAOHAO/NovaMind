"use client";

import { useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActivated: boolean;
  avatar?: string;
}

interface LoginResponse {
  token: string;
  user: User;
  message: string;
}

interface RegisterResponse {
  user: User;
  message: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    const storedToken = localStorage.getItem("novamind_token");
    const storedUser = localStorage.getItem("novamind_user");

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("novamind_token");
        localStorage.removeItem("novamind_user");
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data: LoginResponse & { error?: string } = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "登录失败");
    }

    localStorage.setItem("novamind_token", data.token);
    localStorage.setItem("novamind_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data: RegisterResponse & { error?: string } = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "注册失败");
      }

      return data;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore
    }

    localStorage.removeItem("novamind_token");
    localStorage.removeItem("novamind_user");
    setToken(null);
    setUser(null);
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("novamind_token");
          localStorage.removeItem("novamind_user");
          setToken(null);
          setUser(null);
        }
        return;
      }

      const data: { user: User; error?: string } = await res.json();

      if (data.user) {
        localStorage.setItem("novamind_user", JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch {
      // ignore
    }
  }, [token]);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return {
    user,
    token,
    loading,
    login,
    register,
    logout,
    refreshUser,
    isAdmin,
  };
}
