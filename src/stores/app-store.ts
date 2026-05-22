import { create } from "zustand";

interface AppState {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  wsConnected: boolean;
  isOnline: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: "light" | "dark") => void;
  setWsConnected: (connected: boolean) => void;
  setIsOnline: (online: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  theme: "light",
  wsConnected: false,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("novamind_theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    set({ theme });
  },

  setWsConnected: (connected) => set({ wsConnected: connected }),

  setIsOnline: (online) => set({ isOnline: online }),
}));
