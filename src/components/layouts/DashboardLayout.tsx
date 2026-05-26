"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  BookOpen,
  User,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Brain,
  Timer,
  StickyNote,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/ui/loading-screen";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  isActivated: boolean;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("novamind_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const userStr = localStorage.getItem("novamind_user");
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
    } catch {
      // ignore
    }
  }, [router]);

  const handleLogout = useCallback(async () => {
    try {
      const token = localStorage.getItem("novamind_token");
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // ignore
    }
    localStorage.removeItem("novamind_token");
    localStorage.removeItem("novamind_user");
    router.replace("/login");
  }, [router]);

  if (!mounted) return <LoadingScreen message="加载中..." />;

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const navItems = [
    { href: "/dashboard", label: "首页", icon: Home },
    { href: "/questions", label: "题库", icon: BookOpen },
    { href: "/exams", label: "模拟考试", icon: Timer },
    { href: "/notes", label: "笔记", icon: StickyNote },
    { href: "/analytics", label: "学习分析", icon: BarChart3 },
    { href: "/profile", label: "个人中心", icon: User },
  ];

  const allNavItems = isAdmin
    ? [...navItems, { href: "/admin", label: "管理后台", icon: Shield }]
    : navItems;

  const initials = user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Brain className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-foreground">NovaMind</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {allNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">{user?.name || "用户"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          <div className="hidden items-center gap-2 lg:flex">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold">NovaMind</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">
                  {user?.name || "用户"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>我的账号</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/notes")}>
                <StickyNote className="mr-2 h-4 w-4" />
                我的笔记
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/analytics")}>
                <BarChart3 className="mr-2 h-4 w-4" />
                学习分析
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <User className="mr-2 h-4 w-4" />
                个人中心
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => router.push("/admin")}>
                  <Shield className="mr-2 h-4 w-4" />
                  管理后台
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
