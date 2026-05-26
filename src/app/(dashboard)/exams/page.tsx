"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Clock,
  Brain,
  Trash2,
  Play,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface ExamItem {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  difficulty: number;
  totalQuestions: number;
  correctCount: number;
  score: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  questionCount: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface QuestionBank {
  id: string;
  title: string;
  difficulty: number;
  questionCount: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "草稿", className: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "进行中", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "已完成", className: "bg-green-100 text-green-700" },
  ABANDONED: { label: "已放弃", className: "bg-red-100 text-red-700" },
};

const difficultyLabels: Record<number, string> = {
  1: "简单",
  2: "较易",
  3: "中等",
  4: "较难",
  5: "困难",
};

export default function ExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createTab, setCreateTab] = useState("banks");
  const [creating, setCreating] = useState(false);

  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [examDesc, setExamDesc] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [difficulty, setDifficulty] = useState(3);

  const [aiTopic, setAiTopic] = useState("");
  const [aiQuestionCount, setAiQuestionCount] = useState(10);
  const [aiDuration, setAiDuration] = useState(60);
  const [aiDifficulty, setAiDifficulty] = useState(3);
  const [aiExamTitle, setAiExamTitle] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchExams = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) { router.replace("/login"); return; }

    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/exams?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setExams(data.exams);
        setPagination(data.pagination);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, router]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const fetchBanks = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    setBanksLoading(true);
    try {
      const res = await fetch("/api/questions?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBanks(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setBanksLoading(false);
    }
  }, []);

  const handleOpenCreate = () => {
    setShowCreateDialog(true);
    fetchBanks();
    setCreateTab("banks");
    setExamTitle("");
    setExamDesc("");
    setQuestionCount(20);
    setDurationMinutes(60);
    setDifficulty(3);
    setSelectedBanks([]);
    setAiTopic("");
    setAiQuestionCount(10);
    setAiDuration(60);
    setAiDifficulty(3);
    setAiExamTitle("");
  };

  const handleCreateFromBanks = async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;

    if (!examTitle.trim()) { toast.error("请填写考试标题"); return; }
    if (selectedBanks.length === 0) { toast.error("请选择至少一个题库"); return; }

    setCreating(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: examTitle.trim(),
          description: examDesc.trim() || undefined,
          bankIds: selectedBanks,
          questionCount,
          durationMinutes,
          difficulty,
        }),
      });
      if (res.ok) {
        toast.success("考试创建成功");
        setShowCreateDialog(false);
        fetchExams();
      } else {
        const data = await res.json();
        toast.error(data.error || "创建失败");
      }
    } catch {
      toast.error("创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromAi = async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;

    if (!aiTopic.trim()) { toast.error("请填写考试主题"); return; }

    setCreating(true);
    try {
      const res = await fetch("/api/exams/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          questionCount: aiQuestionCount,
          difficulty: aiDifficulty,
          durationMinutes: aiDuration,
          examTitle: aiExamTitle.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.usage) {
          toast.success(`考试创建成功 (AI 剩余: ${data.usage.limit - data.usage.used}/${data.usage.limit})`);
        } else {
          toast.success("AI 考试生成成功");
        }
        setShowCreateDialog(false);
        fetchExams();
      } else {
        const data = await res.json();
        toast.error(data.error || "AI 生成失败");
      }
    } catch {
      toast.error("AI 生成失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const token = localStorage.getItem("novamind_token");
    if (!token) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/exams/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("考试已删除");
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        fetchExams();
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const toggleBank = (bankId: string) => {
    setSelectedBanks((prev) =>
      prev.includes(bankId)
        ? prev.filter((id) => id !== bankId)
        : [...prev, bankId]
    );
  };

  const formatSeconds = (totalMinutes: number) => {
    if (totalMinutes >= 60) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
    }
    return `${totalMinutes} 分钟`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">模拟考试</h1>
          <p className="text-sm text-muted-foreground mt-1">
            创建和管理模拟考试，检验学习成果
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          创建考试
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="DRAFT">草稿</SelectItem>
            <SelectItem value="IN_PROGRESS">进行中</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="ABANDONED">已放弃</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Exam List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : exams.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">暂无考试</p>
          <p className="text-sm text-muted-foreground mt-1">
            点击"创建考试"开始你的第一次模拟考试
          </p>
          <Button className="mt-4" onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            创建考试
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => {
              const config = statusConfig[exam.status] || statusConfig.DRAFT;
              return (
                <Card
                  key={exam.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => router.push(`/exams/${exam.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {exam.title}
                        </CardTitle>
                        {exam.description && (
                          <CardDescription className="truncate">
                            {exam.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge className={cn("ml-2 shrink-0", config.className)}>
                        {config.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2 space-y-2">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {exam.questionCount} 题
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatSeconds(exam.durationMinutes)}
                      </span>
                      <span>
                        {difficultyLabels[exam.difficulty] || "中等"}
                      </span>
                    </div>
                    {exam.status === "COMPLETED" && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 font-medium text-green-600">
                          <BarChart3 className="h-3.5 w-3.5" />
                          {exam.score} 分
                        </span>
                        <span className="text-muted-foreground">
                          {exam.correctCount}/{exam.totalQuestions} 正确
                        </span>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-muted-foreground">
                        {exam.createdAt}
                      </span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {exam.status === "DRAFT" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/exams/${exam.id}`)}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            开始
                          </Button>
                        )}
                        {exam.status !== "IN_PROGRESS" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setDeleteTarget(exam);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground mx-2">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Exam Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建考试</DialogTitle>
            <DialogDescription>
              从题库选题或使用 AI 生成考试题目
            </DialogDescription>
          </DialogHeader>

          <Tabs value={createTab} onValueChange={setCreateTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="banks">从题库选择</TabsTrigger>
              <TabsTrigger value="ai">AI 生成</TabsTrigger>
            </TabsList>

            <TabsContent value="banks" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>考试标题 *</Label>
                <Input
                  placeholder="如：2024 年前端开发模拟考试"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>描述（可选）</Label>
                <Input
                  placeholder="简要描述考试内容"
                  value={examDesc}
                  onChange={(e) => setExamDesc(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>选择题库 *</Label>
                <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                  {banksLoading ? (
                    <p className="text-sm text-muted-foreground p-2">加载中...</p>
                  ) : banks.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">暂无可用题库</p>
                  ) : (
                    banks.map((bank) => (
                      <label
                        key={bank.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-colors",
                          selectedBanks.includes(bank.id)
                            ? "bg-primary/10"
                            : "hover:bg-accent"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={selectedBanks.includes(bank.id)}
                          onChange={() => toggleBank(bank.id)}
                        />
                        <span className="flex-1 truncate">{bank.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {bank.questionCount}题 | {difficultyLabels[bank.difficulty] || `难度${bank.difficulty}`}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>题目数量: {questionCount}</Label>
                <Slider
                  value={[questionCount]}
                  onValueChange={([v]) => setQuestionCount(v)}
                  min={5}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>考试时长（分钟）: {durationMinutes}</Label>
                <Slider
                  value={[durationMinutes]}
                  onValueChange={([v]) => setDurationMinutes(v)}
                  min={10}
                  max={240}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>难度筛选: {difficultyLabels[difficulty]}</Label>
                <Slider
                  value={[difficulty]}
                  onValueChange={([v]) => setDifficulty(v)}
                  min={1}
                  max={5}
                  step={1}
                />
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>考试标题（可选）</Label>
                <Input
                  placeholder="如：数据结构模拟考试"
                  value={aiExamTitle}
                  onChange={(e) => setAiExamTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>考试主题 *</Label>
                <Input
                  placeholder="如：JavaScript 闭包、React Hooks"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>题目数量: {aiQuestionCount}</Label>
                <Slider
                  value={[aiQuestionCount]}
                  onValueChange={([v]) => setAiQuestionCount(v)}
                  min={5}
                  max={50}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>考试时长（分钟）: {aiDuration}</Label>
                <Slider
                  value={[aiDuration]}
                  onValueChange={([v]) => setAiDuration(v)}
                  min={10}
                  max={240}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>难度: {difficultyLabels[aiDifficulty]}</Label>
                <Slider
                  value={[aiDifficulty]}
                  onValueChange={([v]) => setAiDifficulty(v)}
                  min={1}
                  max={5}
                  step={1}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button
              onClick={createTab === "banks" ? handleCreateFromBanks : handleCreateFromAi}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Brain className="mr-2 h-4 w-4 animate-pulse" />
                  {createTab === "banks" ? "创建中..." : "AI 生成中..."}
                </>
              ) : (
                <>
                  {createTab === "banks" ? (
                    <Plus className="mr-2 h-4 w-4" />
                  ) : (
                    <Brain className="mr-2 h-4 w-4" />
                  )}
                  {createTab === "banks" ? "创建考试" : "AI 生成"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除考试 "{deleteTarget?.title}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
