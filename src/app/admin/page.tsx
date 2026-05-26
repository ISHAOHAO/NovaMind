"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  FileQuestion,
  Key,
  Clock,
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  ArrowRight,
  RotateCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate } from "@/lib/utils";
import { handleApiError } from "@/lib/api-client";
import toast from "react-hot-toast";

interface Stats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalQuestionBanks: number;
  pendingQuestionBanks: number;
  totalQuestions: number;
  totalActivationCodes: number;
  usedActivationCodes: number;
  unusedActivationCodes: number;
  todayNewUsers: number;
  todayLogins: number;
  todayRecords: number;
  activationUsage: number;
  roleDistribution: { USER: number; ADMIN: number; SUPER_ADMIN: number };
  weeklyRegistrations: { date: string; count: number }[];
  dailyRecords: { date: string; count: number }[];
  recentUsers: { id: string; email: string; username: string | null; name: string; avatar: string | null; role: string; createdAt: string }[];
  recentLogs: { id: string; action: string; details: string | null; createdAt: string; user: { name: string; email: string } | null }[];
}

async function fetchApi(path: string) {
  const token = localStorage.getItem("novamind_token");
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("请求失败");
  return res.json();
}

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#ef4444"];
const CHART_COLORS = { primary: "#6366f1", secondary: "#22c55e", muted: "#94a3b8" };

const actionLabels: Record<string, string> = {
  UPDATE_USER: "更新用户",
  DELETE_USER: "删除用户",
  BAN_USER: "封禁用户",
  UNBAN_USER: "解封用户",
  APPROVE_BANK: "通过题库",
  REJECT_BANK: "驳回题库",
  GENERATE_CODES: "生成激活码",
  DELETE_CODES: "删除激活码",
  UPDATE_SETTINGS: "更新设置",
  FORCE_ACTIVATE: "强制激活",
  LOGIN: "登录",
  VERIFY_EMAIL: "邮箱验证",
  CHANGE_ROLE: "角色变更",
  ACTIVATE_USER: "激活用户",
};

const actionVariants: Record<string, string> = {
  LOGIN: "default",
  BAN_USER: "destructive",
  UNBAN_USER: "default",
  APPROVE_BANK: "default",
  REJECT_BANK: "destructive",
  GENERATE_CODES: "default",
  DELETE_CODES: "destructive",
  UPDATE_SETTINGS: "secondary",
  DELETE_USER: "destructive",
  FORCE_ACTIVATE: "default",
  VERIFY_EMAIL: "default",
  CHANGE_ROLE: "secondary",
  ACTIVATE_USER: "default",
};

const roleLabels: Record<string, string> = {
  USER: "用户",
  ADMIN: "管理员",
  SUPER_ADMIN: "超级管理员",
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchApi("/api/admin/dashboard");
      setStats(data);
    } catch (err) {
      setError("加载仪表盘数据失败，请稍后重试");
      handleApiError(err, "加载仪表盘数据失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const statCards = [
    {
      title: "总用户数",
      icon: Users,
      value: stats?.totalUsers,
      color: "text-blue-600 bg-blue-50",
      href: "/admin/users",
    },
    {
      title: "活跃用户",
      icon: UserCheck,
      value: stats?.activeUsers,
      color: "text-green-600 bg-green-50",
      href: "/admin/users?banned=false",
    },
    {
      title: "今日新增",
      icon: UserPlus,
      value: stats?.todayNewUsers,
      color: "text-cyan-600 bg-cyan-50",
      href: "/admin/users",
    },
    {
      title: "封禁用户",
      icon: UserX,
      value: stats?.bannedUsers,
      color: "text-red-600 bg-red-50",
      href: "/admin/users?banned=true",
    },
    {
      title: "待审核题库",
      icon: FileQuestion,
      value: stats?.pendingQuestionBanks,
      color: "text-orange-600 bg-orange-50",
      href: "/admin/questions?status=PENDING",
    },
    {
      title: "激活码使用率",
      icon: Key,
      value: stats != null ? `${stats.activationUsage}%` : null,
      color: "text-purple-600 bg-purple-50",
      href: "/admin/activation-codes",
    },
  ];

  const rolePie = stats
    ? [
        { name: "普通用户", value: stats.roleDistribution.USER },
        { name: "管理员", value: stats.roleDistribution.ADMIN },
        { name: "超级管理员", value: stats.roleDistribution.SUPER_ADMIN },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">管理首页</h1>
          <p className="text-sm text-muted-foreground">欢迎使用 NovaMind 管理后台</p>
        </div>
        <button
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="刷新数据"
        >
          <RotateCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(stat.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn("rounded-md p-1.5", stat.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <div className="text-xl font-bold">{stat.value ?? "-"}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              近7天注册趋势
            </CardTitle>
            <CardDescription>每日新增注册用户数</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats?.weeklyRegistrations || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="注册数"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5" />
              角色分布
            </CardTitle>
            <CardDescription>用户角色占比</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <RePieChart>
                  <Pie
                    data={rolePie}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {rolePie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              近7天答题趋势
            </CardTitle>
            <CardDescription>每日答题记录数</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats?.dailyRecords || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Bar dataKey="count" name="答题数" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  最新用户
                </CardTitle>
                <CardDescription>最近注册的5位用户</CardDescription>
              </div>
              <a href="/admin/users" className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                查看全部 →
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !stats?.recentUsers?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">暂无用户</p>
            ) : (
              <div className="space-y-2">
                {stats.recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 truncate">
                      <p className="truncate text-sm font-medium">{u.name || u.username || u.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {roleLabels[u.role] || u.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                最近操作
              </CardTitle>
              <a href="/admin/logs" className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                查看全部 →
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !stats?.recentLogs?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无操作记录</p>
            ) : (
              <div className="space-y-2">
                {stats.recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3 truncate">
                      <Badge variant={(actionVariants[log.action] as any) || "outline"} className="shrink-0">
                        {actionLabels[log.action] || log.action}
                      </Badge>
                      <span className="truncate text-sm text-muted-foreground">{log.details}</span>
                    </div>
                    <div className="ml-3 shrink-0 text-right text-xs text-muted-foreground">
                      <p>{log.user?.name || "系统"}</p>
                      <p>{formatDate(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              快捷操作
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "用户管理", desc: "查看和管理所有用户", href: "/admin/users", color: "border-l-blue-500" },
              { label: "生成激活码", desc: "批量生成激活码", href: "/admin/activation-codes", color: "border-l-green-500" },
              { label: "题库审核", desc: "审核待审核题库", href: "/admin/questions", color: "border-l-orange-500" },
              { label: "系统设置", desc: "配置系统参数", href: "/admin/settings", color: "border-l-purple-500" },
              { label: "操作日志", desc: "查看系统操作记录", href: "/admin/logs", color: "border-l-cyan-500" },
            ].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className={cn(
                  "rounded-lg border-l-4 border p-3 transition-colors hover:bg-accent",
                  action.color
                )}
              >
                <h3 className="text-sm font-medium">{action.label}</h3>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
                <ArrowRight className="mt-1 h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

