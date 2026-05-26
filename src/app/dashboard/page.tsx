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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  };
  weeklyRecords: { date: string; count: number }[];
  recentActivity: PracticeRecord[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("同学");

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
  }, [router, fetchData]);

  const stats = data?.stats;
  const statCards = [
    { label: "今日答题数", value: stats?.todayCount ?? 0, icon: BookOpen, color: "text-blue-600 bg-blue-100" },
    { label: "正确率", value: `${stats?.correctRate ?? 0}%`, icon: CheckCircle2, color: "text-green-600 bg-green-100" },
    { label: "已收藏", value: stats?.favoriteCount ?? 0, icon: Heart, color: "text-pink-600 bg-pink-100" },
    { label: "学习天数", value: stats?.studyDays ?? 0, icon: CalendarDays, color: "text-purple-600 bg-purple-100" },
  ];

  const quickActions = [
    { label: "开始刷题", icon: Play, href: "/questions", variant: "default" as const },
    { label: "查看错题", icon: AlertTriangle, href: "/questions?filter=wrong", variant: "outline" as const },
    { label: "上传题库", icon: Upload, href: "/questions/upload", variant: "outline" as const },
  ];

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
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
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
