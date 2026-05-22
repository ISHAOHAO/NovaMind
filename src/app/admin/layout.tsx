"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Key,
  FileQuestion,
  Settings,
  FileText,
  Home,
  Menu,
  X,
  Shield,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const adminNavItems: NavItem[] = [
  { href: "/admin", label: "管理首页", icon: Shield },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/activation-codes", label: "激活码管理", icon: Key },
  { href: "/admin/questions", label: "题库审核", icon: FileQuestion },
  { href: "/admin/settings", label: "系统设置", icon: Settings },
  { href: "/admin/logs", label: "操作日志", icon: FileText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const userStr = localStorage.getItem("novamind_user");

      if (!token) {
        router.replace("/login");
        return;
      }

      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (
          parsed.role !== "ADMIN" &&
          parsed.role !== "SUPER_ADMIN"
        ) {
          router.replace("/dashboard");
          return;
        }
        setUser(parsed);
      } else {
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("novamind_token");
    localStorage.removeItem("novamind_user");
    router.replace("/login");
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">NovaMind 管理</span>
        </div>

        <ScrollArea className="flex-1 py-2">
          <nav className="grid gap-1 px-2">
            {adminNavItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t pt-2 px-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Home className="h-4 w-4" />
              返回首页
            </Link>
          </div>
        </ScrollArea>

        {user && (
          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {user.name?.charAt(0) || user.email?.charAt(0) || "A"}
              </div>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium">
                  {user.name || user.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.role === "SUPER_ADMIN" ? "超级管理员" : "管理员"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
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
          <div className="flex-1" />
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
