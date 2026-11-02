"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  AlertTriangle,
  Upload,
  BookOpen,
  CheckCircle2,
  Heart,
  CalendarDays,
  TrendingUp,
  Clock,
  StickyNote,
  BarChart3,
  Flame,
  Target,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface QuestionItem {
  id: string;
  content: string;
  type: string;
  answer: string;
  analysis: string;
  bank: {
    id: string;
    title: string;
    difficulty: number;
  } | null;
}

interface PracticeRecord {
  id: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  duration: number;
  question: QuestionItem;
  createdAt: string;
}

interface DashboardData {
  stats: {
    todayCount: number;
    correctRate: number;
    favoriteCount: number;
    studyDays: number;
    streakDays: number;
    dailyGoal: number;
  };
  weeklyRecords: { date: string; count: number }[];
  recentActivity: PracticeRecord[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("同学");
  const [reviewDueCount, setReviewDueCount] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReviewDue = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    try {
      const res = await fetch("/api/questions/review-due", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setReviewDueCount(typeof json.count === "number" ? json.count : 0);
      }
    } catch {
      setReviewDueCount(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("novamind_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const userStr = localStorage.getItem("novamind_user");
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.name) setUserName(u.name);
      }
    } catch {
      // ignore
    }
    fetchData();
    fetchReviewDue();
  }, [router, fetchData, fetchReviewDue]);

  const stats = data?.stats;
  const statCards = [
    { label: "今日答题", value: stats?.todayCount ?? 0, icon: BookOpen, color: "text-blue-600 bg-blue-100 dark:bg-blue-950" },
    { label: "今日正确率", value: `${stats?.correctRate ?? 0}%`, icon: CheckCircle2, color: "text-green-600 bg-green-100 dark:bg-green-950" },
    { label: "连续学习", value: `${stats?.streakDays ?? 0} 天`, icon: Flame, color: "text-orange-600 bg-orange-100 dark:bg-orange-950" },
    { label: "已收藏", value: stats?.favoriteCount ?? 0, icon: Heart, color: "text-pink-600 bg-pink-100 dark:bg-pink-950" },
  ];

  const quickActions = [
    { label: "开始刷题", icon: Play, href: "/questions", variant: "default" as const },
    { label: "查看错题", icon: AlertTriangle, href: "/analytics", variant: "outline" as const },
    { label: "上传题库", icon: Upload, href: "/questions/upload", variant: "outline" as const },
    { label: "我的收藏", icon: Heart, href: "/favorites", variant: "outline" as const },
    { label: "学习笔记", icon: StickyNote, href: "/notes", variant: "outline" as const },
    { label: "学习分析", icon: BarChart3, href: "/analytics", variant: "outline" as const },
  ];

  // 补全近 7 天（无记录的天补 0），用于趋势图
  const weeklyData = (() => {
    const map = new Map((data?.weeklyRecords ?? []).map((r) => [r.date, r.count]));
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({
        date: key,
        label: i === 0 ? "今天" : `${d.getMonth() + 1}/${d.getDate()}`,
        count: map.get(key) ?? 0,
      });
    }
    return days;
  })();

  const goal = stats?.dailyGoal ?? 20;
  const todayCount = stats?.todayCount ?? 0;
  const goalPercent = Math.min(100, Math.round((todayCount / goal) * 100));
  const goalDone = todayCount >= goal;

  function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    return dateStr.split("T")[0];
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          欢迎回来，{userName}
        </h1>
        <p className="text-sm text-muted-foreground">
          今天继续加油，保持良好的学习状态！
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-10" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                    <div className={cn("rounded-lg p-1.5", stat.color)}>
                      <stat.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 今日目标 + 复习提醒 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              今日目标
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {loading ? "—" : `${todayCount} / ${goal} 题`}
            </span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-3 w-full" />
            ) : (
              <>
                <Progress value={goalPercent} className="h-3" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {goalDone
                    ? "🎉 今日目标已达成，继续保持！"
                    : `还差 ${goal - todayCount} 题完成今日目标`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCcw className="h-4 w-4 text-amber-500" />
              复习提醒
            </CardTitle>
            {reviewDueCount !== null && reviewDueCount > 0 && (
              <Badge variant="secondary">{reviewDueCount} 题待复习</Badge>
            )}
          </CardHeader>
          <CardContent>
            {reviewDueCount === null ? (
              <p className="text-xs text-muted-foreground">复习计划加载中...</p>
            ) : reviewDueCount === 0 ? (
              <p className="text-xs text-muted-foreground">
                暂无到期复习内容。错题会按遗忘曲线安排复习，坚持每日练习！
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  根据遗忘曲线，今天有 {reviewDueCount} 道错题到了最佳复习时间。
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push("/questions?filter=review")}
                >
                  <RefreshCcw className="mr-2 h-3 w-3" />
                  开始复习
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 近 7 天答题趋势 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">近 7 天答题趋势</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number | string) => [`${value} 题`, "答题数"]}
                    cursor={{ fill: "rgba(120,120,120,0.08)" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {weeklyData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={index === weeklyData.length - 1 ? "#6366f1" : "#a5b4fc"}
                        className="dark:opacity-80"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">快捷操作</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Button key={action.label} variant={action.variant} onClick={() => router.push(action.href)}>
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">最近活动</CardTitle>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !data?.recentActivity?.length ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Clock className="mb-2 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">暂无答题记录</p>
              <Button variant="link" className="mt-1" onClick={() => router.push("/questions")}>
                去刷题
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentActivity.map((record) => (
                <div key={record.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{record.question.content}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={record.isCorrect ? "default" : "destructive"} className="text-[10px]">
                        {record.isCorrect ? "正确" : "错误"}
                      </Badge>
                      {record.question.bank && <span>{record.question.bank.title}</span>}
                      <span>{formatRelativeTime(record.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
