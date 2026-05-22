"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  UserPlus,
  FileQuestion,
  Key,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";

interface Stats {
  totalUsers: number;
  todayNewUsers: number;
  pendingBanks: number;
  activationUsage: string;
}

interface Activity {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: { name: string; email: string } | null;
}

async function fetchApi(path: string) {
  const token = localStorage.getItem("novamind_token");
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("请求失败");
  return res.json();
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersData, logsData] = await Promise.all([
          fetchApi("/api/admin/users?limit=1"),
          fetchApi("/api/admin/logs?limit=5"),
        ]);

        const totalUsers = usersData.pagination?.total || 0;
        setStats({
          totalUsers,
          todayNewUsers: 0,
          pendingBanks: 0,
          activationUsage: "0%",
        });
        setActivities(logsData.logs || []);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statCards = [
    {
      title: "总用户数",
      icon: Users,
      value: stats?.totalUsers ?? "-",
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: "今日新增",
      icon: UserPlus,
      value: stats?.todayNewUsers ?? "-",
      color: "text-green-600 bg-green-100",
    },
    {
      title: "待审核题库",
      icon: FileQuestion,
      value: stats?.pendingBanks ?? "-",
      color: "text-orange-600 bg-orange-100",
    },
    {
      title: "激活码使用率",
      icon: Key,
      value: stats?.activationUsage ?? "-",
      color: "text-purple-600 bg-purple-100",
    },
  ];

  const actionLabels: Record<string, string> = {
    UPDATE_USER: "更新用户",
    DELETE_USER: "删除用户",
    BAN_USER: "封禁用户",
    UNBAN_USER: "解封用户",
    APPROVE_BANK: "通过题库",
    REJECT_BANK: "驳回题库",
    GENERATE_CODES: "生成激活码",
    UPDATE_SETTINGS: "更新设置",
    FORCE_ACTIVATE: "强制激活",
    LOGIN: "登录",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">管理首页</h1>
        <p className="text-sm text-muted-foreground">欢迎使用 NovaMind 管理后台</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn("rounded-lg p-2", stat.color)}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              快捷操作
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "用户管理", desc: "管理用户和封禁", href: "/admin/users" },
              { label: "生成激活码", desc: "批量生成激活码", href: "/admin/activation-codes" },
              { label: "题库审核", desc: "审核待审核题库", href: "/admin/questions" },
              { label: "系统设置", desc: "配置系统参数", href: "/admin/settings" },
            ].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <h3 className="font-medium">{action.label}</h3>
                <p className="text-sm text-muted-foreground">{action.desc}</p>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              最近操作
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                暂无操作记录
              </p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium">
                        {actionLabels[activity.action] || activity.action}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {activity.details}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">
                        {activity.user?.name || "系统"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.createdAt
                          ? formatDate(activity.createdAt)
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

