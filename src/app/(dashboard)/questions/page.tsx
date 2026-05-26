"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn, getDifficultyLabel, getDifficultyColor } from "@/lib/utils";

interface QuestionBank {
  id: string;
  title: string;
  description: string;
  source: string;
  category: string;
  tags: string[];
  difficulty: number;
  difficultyLabel: string;
  questionCount: number;
  uploader: { id: string; name: string; avatar: string | null };
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const categories = [
  "前端开发",
  "后端开发",
  "数据库",
  "算法",
  "操作系统",
  "网络",
  "人工智能",
  "软件工程",
  "编程语言",
  "其他",
];

const difficulties = [
  { value: "all", label: "全部难度" },
  { value: "1", label: "简单" },
  { value: "2", label: "较易" },
  { value: "3", label: "中等" },
  { value: "4", label: "较难" },
  { value: "5", label: "困难" },
];

export default function QuestionsPage() {
  const router = useRouter();

  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [tagsInput, setTagsInput] = useState("");

  const [reportOpen, setReportOpen] = useState(false);
  const [reportBank, setReportBank] = useState<QuestionBank | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);

  const fetchBanks = useCallback(async (page = 1) => {
    const token = localStorage.getItem("novamind_token");
    if (!token) { router.replace("/login"); return; }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "12");
      if (search) params.set("search", search);
      if (category && category !== "all") params.set("category", category);
      if (difficulty && difficulty !== "all") params.set("difficulty", difficulty);
      if (tagsInput) params.set("tags", tagsInput);

      const res = await fetch(`/api/questions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBanks(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 0 });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router, search, category, difficulty, tagsInput]);

  useEffect(() => {
    fetchBanks(1);
  }, [fetchBanks]);

  const handleSearch = () => {
    fetchBanks(1);
  };

  const handleSubmitReport = async () => {
    if (!reportBank || !reportReason.trim() || reportReason.trim().length < 5) {
      toast.error("反馈原因至少需要5个字符");
      return;
    }
    setReporting(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionBankId: reportBank.id,
          reason: reportReason.trim(),
        }),
      });
      if (res.ok) {
        toast.success("反馈已提交，管理员会尽快处理");
        setReportOpen(false);
        setReportReason("");
        setReportBank(null);
      } else {
        const data = await res.json();
        toast.error(data.error || "提交失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setReporting(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchBanks(page);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">题库</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 min-w-[200px]">
            <Label className="mb-1.5 block text-xs">搜索</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索题库名称或描述..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>
          <div className="w-[160px]">
            <Label className="mb-1.5 block text-xs">分类</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[140px]">
            <Label className="mb-1.5 block text-xs">难度</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue placeholder="全部难度" />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[160px]">
            <Label className="mb-1.5 block text-xs">标签</Label>
            <Input
              placeholder="逗号分隔"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>
          <Button onClick={handleSearch}>
            <Search className="mr-2 h-4 w-4" />
            搜索
          </Button>
        </CardContent>
      </Card>

      {/* Question bank grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : banks.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <BookOpen className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">未找到题库</p>
          <Button variant="link" onClick={() => { setSearch(""); setCategory("all"); setDifficulty("all"); setTagsInput(""); }}>
            清除筛选
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {banks.map((bank) => (
              <Card
                key={bank.id}
                className="cursor-pointer transition-shadow hover:shadow-md group"
                onClick={() => router.push(`/questions/${bank.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-1">{bank.title}</CardTitle>
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="反馈题库"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportBank(bank);
                          setReportReason("");
                          setReportOpen(true);
                        }}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground hover:text-orange-600" />
                      </Button>
                      <Badge className={cn("shrink-0", getDifficultyColor(bank.difficulty))}>
                        {bank.difficultyLabel}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {bank.description || "暂无描述"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{bank.category}</Badge>
                    <span>{bank.questionCount} 道题目</span>
                  </div>
                  {bank.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {bank.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                      {bank.tags.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{bank.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                下一页
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Floating upload button */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        size="icon"
        onClick={() => router.push("/questions/upload")}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={reportOpen} onOpenChange={(open) => { setReportOpen(open); if (!open) setReportBank(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>反馈题库</DialogTitle>
            <DialogDescription>
              {reportBank?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>反馈原因</Label>
            <Textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="请描述题库存在的问题，如：答案错误、题目不规范、分类不当等..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReportOpen(false); setReportReason(""); }}>
              取消
            </Button>
            <Button onClick={handleSubmitReport} disabled={reporting || reportReason.trim().length < 5}>
              {reporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />提交中...</> : "提交反馈"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
