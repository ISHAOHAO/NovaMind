"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  AlertTriangle,
  Globe,
  Ban,
  TrendingUp,
  Activity,
  RotateCw,
  Search,
  Lock,
  Unlock,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

const CHART_COLORS = {
  success: "#22c55e",
  failed: "#ef4444",
  primary: "#6366f1",
  warning: "#f59e0b",
};

const riskLevelColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-300",
  medium: "bg-orange-100 text-orange-700 border-orange-300",
  low: "bg-yellow-100 text-yellow-700 border-yellow-300",
  normal: "bg-green-100 text-green-700 border-green-300",
};

const riskLevelLabels: Record<string, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险",
  normal: "正常",
};

interface Overview {
  totalAttempts24h: number;
  failedAttempts24h: number;
  failedRate24h: number;
  uniqueIps24h: number;
  blockedIps: number;
  todayAttempts: number;
  todayFailed: number;
  weeklyAttempts: number;
  weeklyFailed: number;
  topFailedIps: { ip: string; count: number }[];
  topFailedEmails: { email: string; count: number }[];
  hourlyAttempts: { hour: string; count: number; failed: number }[];
}

interface IpInfo {
  ip: string;
  totalCount: number;
  failedCount: number;
  successCount: number;
  lastAttemptAt: string;
  uniqueEmails: number;
  recentCount: number;
  recentFailed: number;
  isBlocked: boolean;
  riskLevel: string;
}

interface LoginAttempt {
  id: string;
  userId: string | null;
  email: string;
  ip: string;
  success: boolean;
  reason: string | null;
  userAgent: string | null;
  createdAt: string;
}

async function fetchApi(path: string, options?: RequestInit) {
  const token = localStorage.getItem("novamind_token");
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "请求失败");
  }
  return res.json();
}

export default function RiskControlPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ips, setIps] = useState<IpInfo[]>([]);
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [ipsPage, setIpsPage] = useState(1);
  const [ipsTotal, setIpsTotal] = useState(0);
  const [ipsSearch, setIpsSearch] = useState("");
  const [ipsLimit] = useState(20);
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; ip: string }>({ open: false, ip: "" });
  const [blockReason, setBlockReason] = useState("");
  const [blockDuration, setBlockDuration] = useState(24);
  const [blocking, setBlocking] = useState(false);
  const [tab, setTab] = useState<"overview" | "ips" | "attempts">("overview");

  const loadOverview = useCallback(async () => {
    try {
      const data = await fetchApi("/api/admin/risk-control/overview");
      setOverview(data);
    } catch {
      toast.error("加载风控概览失败");
    }
  }, []);

  const loadIps = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(ipsPage));
      params.set("limit", String(ipsLimit));
      if (ipsSearch) params.set("search", ipsSearch);
      const data = await fetchApi(`/api/admin/risk-control/ips?${params}`);
      setIps(data.ips);
      setIpsTotal(data.pagination.total);
    } catch {
      toast.error("加载IP列表失败");
    }
  }, [ipsPage, ipsLimit, ipsSearch]);

  const loadAttempts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "50");
      const data = await fetchApi(`/api/admin/risk-control/attempts?${params}`);
      setAttempts(data.attempts);
    } catch {
      // ignore
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOverview(), loadIps(), loadAttempts()]);
    setLoading(false);
  }, [loadOverview, loadIps, loadAttempts]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadIps();
  }, [ipsPage, ipsSearch]);

  const handleBlock = async () => {
    if (!blockDialog.ip) return;
    setBlocking(true);
    try {
      await fetchApi("/api/admin/risk-control/ips", {
        method: "POST",
        body: JSON.stringify({
          ip: blockDialog.ip,
          reason: blockReason || null,
          durationHours: blockDuration || null,
        }),
      });
      toast.success(`IP ${blockDialog.ip} 已封禁`);
      setBlockDialog({ open: false, ip: "" });
      setBlockReason("");
      setBlockDuration(24);
      loadIps();
      loadOverview();
    } catch (err: any) {
      toast.error(err.message || "操作失败");
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (ip: string) => {
    try {
      await fetchApi(`/api/admin/risk-control/ips?ip=${encodeURIComponent(ip)}`, {
        method: "DELETE",
      });
      toast.success(`IP ${ip} 已解封`);
      loadIps();
      loadOverview();
    } catch {
      toast.error("操作失败");
    }
  };

  const chartData = (overview?.hourlyAttempts || [])
    .slice()
    .reverse()
    .map((h) => ({
      hour: h.hour.slice(11),
      total: h.count,
      failed: h.failed,
      success: h.count - h.failed,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">登录风控</h1>
          <p className="text-sm text-muted-foreground">IP登录行为分析与风险控制</p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="刷新数据"
        >
          <RotateCw className={cn("h-5 w-5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { title: "24h 登录尝试", value: overview?.totalAttempts24h, icon: Activity, color: "text-blue-600 bg-blue-50" },
          { title: "24h 失败率", value: overview != null ? `${overview.failedRate24h}%` : null, icon: AlertTriangle, color: overview && overview.failedRate24h > 30 ? "text-red-600 bg-red-50" : "text-orange-600 bg-orange-50" },
          { title: "24h 独立IP", value: overview?.uniqueIps24h, icon: Globe, color: "text-cyan-600 bg-cyan-50" },
          { title: "今日失败", value: overview?.todayFailed, icon: XCircle, color: "text-red-600 bg-red-50" },
          { title: "已封禁IP", value: overview?.blockedIps, icon: Ban, color: "text-purple-600 bg-purple-50" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">{stat.title}</CardTitle>
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

      <div className="flex gap-2">
        {[
          { key: "overview", label: "趋势分析", icon: TrendingUp },
          { key: "ips", label: "IP管理", icon: Globe },
          { key: "attempts", label: "登录记录", icon: Activity },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.key as any)}
            >
              <Icon className="mr-1.5 h-4 w-4" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5" />
                  24h 登录趋势
                </CardTitle>
                <CardDescription>每小时登录尝试数（成功 / 失败）</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-72 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                      />
                      <Legend />
                      <Bar dataKey="success" name="成功" stackId="a" fill={CHART_COLORS.success} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="failed" name="失败" stackId="a" fill={CHART_COLORS.failed} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5" />
                  7天趋势
                </CardTitle>
                <CardDescription>每日登录失败次数曲线</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-72 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={(overview?.hourlyAttempts || [])
                      .slice()
                      .reverse()
                      .reduce((acc: { date: string; failed: number }[], h) => {
                        const day = h.hour.slice(0, 10);
                        const existing = acc.find((a) => a.date === day);
                        if (existing) {
                          existing.failed += h.failed;
                        } else {
                          acc.push({ date: day, failed: h.failed });
                        }
                        return acc;
                      }, [])
                      .slice(-7)
                    }>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                      <Line
                        type="monotone"
                        dataKey="failed"
                        name="失败次数"
                        stroke={CHART_COLORS.failed}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  24h 失败IP TOP10
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : !overview?.topFailedIps?.length ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">暂无数据</p>
                ) : (
                  <div className="space-y-1">
                    {overview.topFailedIps.map((item, idx) => (
                      <div key={item.ip} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent">
                        <div className="flex items-center gap-3">
                          <span className={cn("text-xs font-bold w-5", idx < 3 ? "text-red-500" : "text-muted-foreground")}>
                            {idx + 1}
                          </span>
                          <span className="font-mono text-sm">{item.ip}</span>
                        </div>
                        <Badge variant="destructive" className="text-xs">{item.count} 次</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5" />
                  24h 失败邮箱 TOP10
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : !overview?.topFailedEmails?.length ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">暂无数据</p>
                ) : (
                  <div className="space-y-1">
                    {overview.topFailedEmails.map((item, idx) => (
                      <div key={item.email} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent">
                        <div className="flex items-center gap-3">
                          <span className={cn("text-xs font-bold w-5", idx < 3 ? "text-red-500" : "text-muted-foreground")}>
                            {idx + 1}
                          </span>
                          <span className="text-sm">{item.email}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{item.count} 次</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {tab === "ips" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">IP 管理</CardTitle>
                <CardDescription>查看和管理登录IP，支持封禁/解封操作</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="搜索IP..."
                  value={ipsSearch}
                  onChange={(e) => { setIpsSearch(e.target.value); setIpsPage(1); }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !ips.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无IP数据</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">IP地址</th>
                        <th className="pb-2 font-medium">风险等级</th>
                        <th className="pb-2 font-medium text-right">总次数</th>
                        <th className="pb-2 font-medium text-right">失败</th>
                        <th className="pb-2 font-medium text-right">成功率</th>
                        <th className="pb-2 font-medium text-right">24h活跃</th>
                        <th className="pb-2 font-medium text-right">最近活动</th>
                        <th className="pb-2 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ips.map((row) => (
                        <tr key={row.ip} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5 pr-4 font-mono text-xs">{row.ip}</td>
                          <td className="py-2.5 pr-4">
                            <Badge className={cn("text-xs border", riskLevelColors[row.riskLevel])} variant="outline">
                              {riskLevelLabels[row.riskLevel]}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4 text-right">{row.totalCount}</td>
                          <td className="py-2.5 pr-4 text-right">
                            <span className={row.failedCount > 10 ? "text-red-600 font-medium" : ""}>{row.failedCount}</span>
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            {row.totalCount > 0
                              ? `${Math.round((row.successCount / row.totalCount) * 100)}%`
                              : "-"}
                          </td>
                          <td className="py-2.5 pr-4 text-right">{row.recentCount}</td>
                          <td className="py-2.5 pr-4 text-right text-xs text-muted-foreground">
                            {formatDate(row.lastAttemptAt)}
                          </td>
                          <td className="py-2.5 text-right">
                            {row.isBlocked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnblock(row.ip)}
                              >
                                <Unlock className="mr-1 h-3.5 w-3.5" />
                                解封
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => setBlockDialog({ open: true, ip: row.ip })}
                              >
                                <Lock className="mr-1 h-3.5 w-3.5" />
                                封禁
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {ipsTotal > ipsLimit && (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      共 {ipsTotal} 条，第 {ipsPage}/{Math.ceil(ipsTotal / ipsLimit)} 页
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={ipsPage <= 1} onClick={() => setIpsPage(ipsPage - 1)}>
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ipsPage >= Math.ceil(ipsTotal / ipsLimit)}
                        onClick={() => setIpsPage(ipsPage + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "attempts" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">登录记录</CardTitle>
            <CardDescription>最近50条登录尝试记录</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !attempts.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无记录</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">时间</th>
                      <th className="pb-2 font-medium">邮箱</th>
                      <th className="pb-2 font-medium">IP</th>
                      <th className="pb-2 font-medium">结果</th>
                      <th className="pb-2 font-medium">原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(a.createdAt)}
                        </td>
                        <td className="py-2 pr-4 text-xs">{a.email}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{a.ip}</td>
                        <td className="py-2 pr-4">
                          {a.success ? (
                            <Badge variant="default" className="text-xs bg-green-100 text-green-700 hover:bg-green-100">
                              <CheckCircle2 className="mr-0.5 h-3 w-3" />
                              成功
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="mr-0.5 h-3 w-3" />
                              失败
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground max-w-40 truncate">
                          {a.reason || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={blockDialog.open} onOpenChange={(o) => setBlockDialog({ open: o, ip: o ? blockDialog.ip : "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              封禁IP
            </DialogTitle>
            <DialogDescription>封禁后该IP将无法登录系统</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3">
              <Label className="text-xs text-muted-foreground">IP地址</Label>
              <p className="font-mono text-sm font-medium">{blockDialog.ip}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockReason">封禁原因</Label>
              <Input
                id="blockReason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="可选：填写封禁原因"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockDuration">封禁时长（小时）</Label>
              <Input
                id="blockDuration"
                type="number"
                min={1}
                max={720}
                value={blockDuration}
                onChange={(e) => setBlockDuration(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">留空或设为0表示永久封禁</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog({ open: false, ip: "" })}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleBlock} disabled={blocking}>
              {blocking ? "封禁中..." : "确认封禁"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
