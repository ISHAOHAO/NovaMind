import { create } from "zustand";
import { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: (user, token) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("novamind_token", token);
      localStorage.setItem("novamind_user", JSON.stringify(user));
    }
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("novamind_token");
      localStorage.removeItem("novamind_user");
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  updateUser: (userData) => {
    const currentUser = get().user;
    if (currentUser) {
      const updated = { ...currentUser, ...userData };
      if (typeof window !== "undefined") {
        localStorage.setItem("novamind_user", JSON.stringify(updated));
      }
      set({ user: updated });
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),

  initialize: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("novamind_token");
      const userStr = localStorage.getItem("novamind_user");
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr) as User;
          set({ user, token, isAuthenticated: true, isLoading: false });
          return;
        } catch {
          // JSON 解析失败，清除无效数据
        }
      }
    }
    set({ isLoading: false });
  },
}));
