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
import { formatRelativeTime, cn } from "@/lib/utils";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  isActivated: boolean;
}

interface PracticeRecord {
  id: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  duration: number;
  question: {
    id: string;
    content: string;
    type: string;
    answer: string;
    analysis: string;
    bank: {
      id: string;
      title: string;
      difficulty: number;
      difficultyLabel: string;
    } | null;
  };
  createdAt: string;
}

interface DashboardStats {
  todayCount: number;
  correctRate: number;
  favoriteCount: number;
  studyDays: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    todayCount: 0,
    correctRate: 0,
    favoriteCount: 0,
    studyDays: 0,
  });
  const [recentActivity, setRecentActivity] = useState<PracticeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [historyRes, favoritesRes] = await Promise.all([
        fetch("/api/questions/practice/history?limit=5", { headers }),
        fetch("/api/questions/favorites?limit=1", { headers }),
      ]);

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const records: PracticeRecord[] = historyData.data || [];
        setRecentActivity(records);

        const today = new Date().toDateString();
        const todayRecords = records.filter(
          (r) => new Date(r.createdAt).toDateString() === today
        );

        let correctCount = 0;
        let totalToday = 0;
        const studyDaySet = new Set<string>();

        records.forEach((r) => {
          const d = new Date(r.createdAt).toDateString();
          studyDaySet.add(d);
          if (new Date(r.createdAt).toDateString() === today) {
            totalToday++;
            if (r.isCorrect) correctCount++;
          }
        });

        setStats((prev) => ({
          ...prev,
          todayCount: totalToday,
          correctRate: totalToday > 0 ? Math.round((correctCount / totalToday) * 100) : prev.correctRate,
          studyDays: studyDaySet.size,
        }));
      }

      if (favoritesRes.ok) {
        const favData = await favoritesRes.json();
        const favTotal = favData.pagination?.total || favData.data?.length || 0;
        setStats((prev) => ({ ...prev, favoriteCount: favTotal }));
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
        setUser(JSON.parse(userStr));
      }
    } catch {
      // ignore
    }
    fetchData();
  }, [router, fetchData]);

  const statCards = [
    {
      label: "今日答题数",
      value: stats.todayCount,
      icon: BookOpen,
      color: "text-blue-600 bg-blue-100",
    },
    {
      label: "正确率",
      value: `${stats.correctRate}%`,
      icon: CheckCircle2,
      color: "text-green-600 bg-green-100",
    },
    {
      label: "已收藏",
      value: stats.favoriteCount,
      icon: Heart,
      color: "text-pink-600 bg-pink-100",
    },
    {
      label: "学习天数",
      value: stats.studyDays,
      icon: CalendarDays,
      color: "text-purple-600 bg-purple-100",
    },
  ];

  const quickActions = [
    {
      label: "开始刷题",
      icon: Play,
      href: "/questions",
      variant: "default" as const,
    },
    {
      label: "查看错题",
      icon: AlertTriangle,
      href: "/questions?filter=wrong",
      variant: "outline" as const,
    },
    {
      label: "上传题库",
      icon: Upload,
      href: "/questions/upload",
      variant: "outline" as const,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          欢迎回来，{user?.name || "同学"}
        </h1>
        <p className="text-sm text-muted-foreground">
          今天继续加油，保持良好的学习状态！
        </p>
      </div>

      {/* Stats cards */}
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
                    <span className="text-sm text-muted-foreground">
                      {stat.label}
                    </span>
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

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">快捷操作</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              onClick={() => router.push(action.href)}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Recent activity */}
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
          ) : recentActivity.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Clock className="mb-2 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">暂无答题记录</p>
              <Button
                variant="link"
                className="mt-1"
                onClick={() => router.push("/questions")}
              >
                去刷题
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {record.question.content}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant={record.isCorrect ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {record.isCorrect ? "正确" : "错误"}
                      </Badge>
                      {record.question.bank && (
                        <span>{record.question.bank.title}</span>
                      )}
                      <span>
                        {formatRelativeTime(record.createdAt)}
                      </span>
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
