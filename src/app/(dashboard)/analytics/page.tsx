"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  Target,
  BookOpen,
  Flame,
  Brain,
  Sparkles,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Overview {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  correctRate: number;
  todayQuestions: number;
  totalBanks: number;
  activeDays: number;
  avgDuration: number;
}

interface TrendItem {
  label: string;
  total: number;
  correct: number;
  wrong: number;
  correctRate: number;
}

interface WeakPoint {
  category: string;
  errorCount: number;
  knowledgeGaps: string[];
  suggestion: string;
}

interface ErrorQuestion {
  id: string;
  questionId: string;
  userAnswer: string;
  duration: number;
  createdAt: string;
  question: {
    id: string;
    content: string;
    type: string;
    answer: string;
    analysis: string | null;
    bank: {
      id: string;
      title: string;
      category: string;
      difficulty: number;
    } | null;
  };
}

interface Coverage {
  category: string;
  attempted: number;
  total: number;
  rate: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PIE_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
];

function getDifficultyLabel(level: number): string {
  const labels: Record<number, string> = {
    1: "简单",
    2: "较易",
    3: "中等",
    4: "较难",
    5: "困难",
  };
  return labels[level] || "未知";
}

function getDifficultyColor(level: number): string {
  const colors: Record<number, string> = {
    1: "text-green-600 bg-green-100",
    2: "text-emerald-600 bg-emerald-100",
    3: "text-yellow-600 bg-yellow-100",
    4: "text-orange-600 bg-orange-100",
    5: "text-red-600 bg-red-100",
  };
  return colors[level] || "text-gray-600 bg-gray-100";
}

function getCategoryColor(category: string): string {
  const index =
    Math.abs(
      category.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
    ) % PIE_COLORS.length;
  return PIE_COLORS[index];
}

export default function AnalyticsPage() {
  const router = useRouter();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [period, setPeriod] = useState("week");
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);

  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number } | null>(null);
  const [loadingWeak, setLoadingWeak] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const [errorQuestions, setErrorQuestions] = useState<ErrorQuestion[]>([]);
  const [errorPagination, setErrorPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [errorCategory, setErrorCategory] = useState("all");
  const [loadingErrors, setLoadingErrors] = useState(true);

  const categories = Array.from(
    new Set(coverage.map((c) => c.category).filter(Boolean))
  );

  const fetchOverview = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoadingOverview(true);
    try {
      const res = await fetch("/api/analytics/overview", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setOverview(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoadingOverview(false);
    }
  }, [router]);

  const fetchTrends = useCallback(async (p: string) => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    setLoadingTrends(true);
    try {
      const res = await fetch(`/api/analytics/time-trends?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrends(data.trends || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTrends(false);
    }
  }, []);

  const fetchWeakPoints = useCallback(async (forceRefresh = false) => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    if (forceRefresh) {
      setAnalyzing(true);
    } else {
      setLoadingWeak(true);
    }
    try {
      const res = await fetch(
        `/api/analytics/weak-points${forceRefresh ? "?t=" + Date.now() : ""}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setWeakPoints(data.weakPoints || []);
        if (data.usage) setAiUsage(data.usage);
      }
    } catch {
      // ignore
    } finally {
      setLoadingWeak(false);
      setAnalyzing(false);
    }
  }, []);

  const fetchErrorBank = useCallback(async (page = 1, cat = "all") => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    setLoadingErrors(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (cat && cat !== "all") params.set("category", cat);

      // Bypass cache with timestamp for fresh data
      const res = await fetch(
        `/api/analytics/error-bank?${params}&_t=${Date.now()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setErrorQuestions(data.errorQuestions || []);
        setErrorPagination(
          data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
        );
        setCoverage(data.coverage || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingErrors(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchTrends(period);
    fetchWeakPoints();
    fetchErrorBank(1, "all");
  }, [fetchOverview, fetchTrends, fetchWeakPoints, fetchErrorBank]);

  const handlePeriodChange = (p: string) => {
    setPeriod(p);
    fetchTrends(p);
  };

  const handleRefreshWeak = () => {
    fetchWeakPoints(true);
  };

  const handleErrorPageChange = (page: number) => {
    fetchErrorBank(page, errorCategory);
  };

  const handleCategoryFilter = (cat: string) => {
    setErrorCategory(cat);
    fetchErrorBank(1, cat);
  };

  const overviewCards = [
    {
      title: "总答题数",
      value: overview?.totalQuestions ?? 0,
      subtitle: `正确 ${overview?.correctCount ?? 0} 道`,
      icon: BookOpen,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: "正确率",
      value: `${overview?.correctRate ?? 0}%`,
      subtitle: `错误 ${overview?.wrongCount ?? 0} 道`,
      icon: Target,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "今日练习",
      value: overview?.todayQuestions ?? 0,
      subtitle: `涉及 ${overview?.totalBanks ?? 0} 个题库`,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      title: "活跃天数",
      value: overview?.activeDays ?? 0,
      subtitle: `平均每题 ${overview?.avgDuration ?? 0}秒`,
      icon: Flame,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
  ];

  const coveragePieData = coverage
    .filter((c) => c.attempted > 0)
    .map((c) => ({
      name: c.category,
      value: c.attempted,
      rate: c.rate,
    }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">学习分析</h1>
        <Button variant="outline" size="sm" onClick={() => { fetchOverview(); fetchTrends(period); fetchErrorBank(errorPagination.page, errorCategory); }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新数据
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {overviewCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-full p-1.5 ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <>
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="mt-1 h-3 w-24" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {card.subtitle}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Time Trends Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              学习趋势
            </CardTitle>
            <CardDescription>答题量的时间变化</CardDescription>
          </div>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">今日</SelectItem>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loadingTrends ? (
            <Skeleton className="h-64 w-full" />
          ) : trends.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <BarChart3 className="mr-2 h-5 w-5" />
              暂无答题数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ fontWeight: "bold" }}
                />
                <Bar
                  dataKey="correct"
                  name="正确"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="wrong"
                  name="错误"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Weak Points + Coverage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weak Knowledge Points */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                薄弱知识点
              </CardTitle>
              <CardDescription>
                {aiUsage
                  ? `AI 分析 · 已用 ${aiUsage.used}/${aiUsage.limit} 次`
                  : "AI 驱动的错题聚类分析"}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshWeak}
              disabled={analyzing}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {analyzing ? "分析中..." : "AI 分析"}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingWeak ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : weakPoints.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                <Brain className="mb-2 h-10 w-10" />
                <p className="text-sm">
                  暂无薄弱知识点分析
                </p>
                <p className="mt-1 text-xs">
                  参与更多练习后，点击 AI 分析获取建议
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {weakPoints.map((wp, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-muted/30 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="font-medium"
                      >
                        {wp.category}
                      </Badge>
                      <Badge variant="destructive" className="text-xs">
                        {wp.errorCount} 道错题
                      </Badge>
                    </div>
                    {wp.knowledgeGaps.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {wp.knowledgeGaps.map((gap, j) => (
                          <Badge
                            key={j}
                            variant="secondary"
                            className="text-xs"
                          >
                            {gap}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {wp.suggestion && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {wp.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coverage Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              知识点覆盖
            </CardTitle>
            <CardDescription>各分类题目答题覆盖情况</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingErrors ? (
              <Skeleton className="mx-auto h-48 w-48 rounded-full" />
            ) : coveragePieData.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                <BookOpen className="mb-2 h-10 w-10" />
                <p className="text-sm">暂无覆盖数据</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={coveragePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {coveragePieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${value} 题`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-2">
                  {coverage.map((c, i) => (
                    <div key={c.category} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      <span className="flex-1 text-xs">{c.category}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.attempted}/{c.total} ({c.rate}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error Question Bank */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              错题本
            </CardTitle>
            <CardDescription>
              共 {errorPagination.total} 道错题记录
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={errorCategory}
              onValueChange={handleCategoryFilter}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder="分类筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingErrors ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : errorQuestions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <BookOpen className="mb-2 h-10 w-10" />
              <p className="text-sm">暂无错题记录</p>
              <p className="text-xs">继续练习，错题将自动收录</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-2 font-medium">题目</th>
                      <th className="pb-2 pr-2 font-medium">分类</th>
                      <th className="pb-2 pr-2 font-medium">你的答案</th>
                      <th className="pb-2 pr-2 font-medium">正确答案</th>
                      <th className="pb-2 font-medium">难度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorQuestions.map((eq) => (
                      <tr
                        key={eq.id}
                        className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                        onClick={() =>
                          router.push(
                            `/questions/${eq.question.bank?.id}?questionId=${eq.questionId}`
                          )
                        }
                      >
                        <td className="max-w-[200px] truncate py-3 pr-2">
                          {eq.question.content}
                        </td>
                        <td className="py-3 pr-2">
                          <Badge variant="secondary" className="text-xs">
                            {eq.question.bank?.category || "未知"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-2">
                          <span className="font-medium text-red-600">
                            {eq.userAnswer}
                          </span>
                        </td>
                        <td className="py-3 pr-2">
                          <span className="font-medium text-green-600">
                            {eq.question.answer}
                          </span>
                        </td>
                        <td className="py-3">
                          <Badge
                            className={`text-xs ${getDifficultyColor(
                              eq.question.bank?.difficulty || 1
                            )}`}
                          >
                            {getDifficultyLabel(
                              eq.question.bank?.difficulty || 1
                            )}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errorPagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={errorPagination.page <= 1}
                    onClick={() =>
                      handleErrorPageChange(errorPagination.page - 1)
                    }
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {errorPagination.page} / {errorPagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      errorPagination.page >= errorPagination.totalPages
                    }
                    onClick={() =>
                      handleErrorPageChange(errorPagination.page + 1)
                    }
                  >
                    下一页
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
