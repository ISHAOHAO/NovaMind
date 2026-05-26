"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Search,
  CheckCircle,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Trash2,
  EyeOff,
  Globe,
  PlayCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { formatDate, getDifficultyLabel, getDifficultyColor } from "@/lib/utils";

interface QuestionBank {
  id: string;
  title: string;
  description: string | null;
  source: string;
  category: string;
  tags: string[];
  difficulty: number;
  status: string;
  isPublic: boolean;
  reviewComment: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { questions: number };
  uploader: { id: string; email: string; name: string } | null;
  reviewer: { id: string; email: string; name: string } | null;
}

interface Question {
  id: string;
  type: string;
  content: string;
  options: { key: string; value: string }[] | null;
  answer: string;
  analysis: string | null;
  image?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface BankDetail extends QuestionBank {
  questions: Question[];
}

interface ReviewTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  isDefault: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusLabels: Record<string, string> = {
  PENDING: "待审核",
  REVIEWING: "审核中",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  NEEDS_REVISION: "需修改",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  REVIEWING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  NEEDS_REVISION: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const questionTypeLabels: Record<string, string> = {
  single: "单选题",
  multiple: "多选题",
  truefalse: "判断题",
  fillblank: "填空题",
  cloze: "完形填空",
};

const categories = [
  "前端开发", "后端开发", "数据库", "算法", "操作系统", "网络", "人工智能", "软件工程", "编程语言", "其他",
];

export default function QuestionsPage() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [reviewBank, setReviewBank] = useState<BankDetail | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);

  const [deleteBank, setDeleteBank] = useState<QuestionBank | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [reReviewing, setReReviewing] = useState(false);

  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<any[] | null>(null);
  const [aiReviewError, setAiReviewError] = useState("");
  const [aiReviewRaw, setAiReviewRaw] = useState("");

  const fetchBanks = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/questions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBanks(data.banks || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch {
      toast.error("获取题库列表失败");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchBanks(1);
  }, [fetchBanks]);

  const fetchTemplates = useCallback(async () => {
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/admin/review-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      // 模板加载失败不影响主流程
    }
  }, []);

  const handleViewDetail = async (bankId: string, autoStartReview: boolean = false) => {
    setReviewLoading(true);
    setReviewOpen(true);
    setReviewComment("");
    setSelectedTemplateId("");
    setAiReviewResult(null);
    setAiReviewError("");
    setAiReviewRaw("");
    fetchTemplates();
    try {
      const token = localStorage.getItem("novamind_token");
      if (autoStartReview) {
        await fetch(`/api/admin/questions/${bankId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "REVIEWING" }),
        });
      }
      const res = await fetch(`/api/admin/questions/${bankId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReviewBank(data.bank || null);
      if (autoStartReview) {
        fetchBanks(pagination.page);
        toast.success("已开始审核");
      }
      if (data.bank?.reviewComment) {
        setReviewComment(data.bank.reviewComment);
      }
      if (data.bank?.reviewTemplateId) {
        setSelectedTemplateId(data.bank.reviewTemplateId);
      }
    } catch {
      toast.error("获取题库详情失败");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReview = async (bankId: string, status: string) => {
    setReviewing(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/questions/${bankId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          comment: reviewComment || undefined,
          reviewTemplateId: selectedTemplateId || undefined,
        }),
      });
      if (res.ok) {
        toast.success(status === "APPROVED" ? "审核通过" : status === "REJECTED" ? "已驳回" : "已标记为需修改");
        setReviewOpen(false);
        setReviewBank(null);
        fetchBanks(pagination.page);
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setReviewing(false);
    }
  };

  const handleReReview = async (bankId: string) => {
    setReReviewing(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/questions/${bankId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "REVIEWING", comment: "", reviewTemplateId: null }),
      });
      if (res.ok) {
        toast.success("已重新开始审核");
        fetchBanks(pagination.page);
        handleViewDetail(bankId);
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setReReviewing(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setReviewComment(template.content);
    }
  };

  const handleAiReview = async () => {
    if (!reviewBank) return;
    setAiReviewing(true);
    setAiReviewError("");
    setAiReviewResult(null);
    setAiReviewRaw("");
    try {
      const token = localStorage.getItem("novamind_token");
      const questions = reviewBank.questions.map((q) => ({
        type: q.type,
        content: q.content,
        options: q.options || [],
        answer: q.answer,
        analysis: q.analysis || "",
      }));

      const res = await fetch("/api/ai/review-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questions }),
      });

      const data = await res.json();
      if (data.success && data.reviews && data.reviews.length > 0) {
        setAiReviewResult(data.reviews);
        if (data.rawContent) {
          setAiReviewRaw(data.rawContent);
          toast("AI 返回格式异常，已显示回退结果", { icon: "⚠️" });
        } else {
          const issueCount = data.reviews.filter((r: any) => r.hasIssue).length;
          toast.success(`AI 分析完成：${issueCount > 0 ? `发现 ${issueCount} 个问题` : "未发现问题"}`);
        }
      } else {
        setAiReviewError(data.error || "AI 分析失败");
        toast.error(data.error || "AI 分析失败");
      }
    } catch {
      setAiReviewError("网络错误，请稍后重试");
      toast.error("AI 分析失败");
    } finally {
      setAiReviewing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteBank) return;
    setManagingId(deleteBank.id);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/questions/${deleteBank.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("题库已删除");
        setDeleteOpen(false);
        setDeleteBank(null);
        fetchBanks(pagination.page);
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setManagingId(null);
    }
  };

  const handleTogglePublic = async (bank: QuestionBank) => {
    setManagingId(bank.id);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/questions/${bank.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPublic: !bank.isPublic }),
      });
      if (res.ok) {
        toast.success(bank.isPublic ? "已隐藏" : "已公开");
        fetchBanks(pagination.page);
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setManagingId(null);
    }
  };

  const renderStatusBadge = (status: string) => (
    <Badge className={statusColors[status] || ""}>
      {statusLabels[status] || status}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">题库管理</h1>
        <p className="text-sm text-muted-foreground">审核和管理所有题库</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">题库列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索题库标题或描述..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="PENDING">待审核</SelectItem>
                <SelectItem value="REVIEWING">审核中</SelectItem>
                <SelectItem value="APPROVED">已通过</SelectItem>
                <SelectItem value="REJECTED">已驳回</SelectItem>
                <SelectItem value="NEEDS_REVISION">需修改</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="分类筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>标题</TableHead>
                    <TableHead>上传者</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>难度</TableHead>
                    <TableHead>题目数</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>审核人</TableHead>
                    <TableHead>公开</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground">
                        暂无题库
                      </TableCell>
                    </TableRow>
                  ) : (
                    banks.map((bank) => (
                      <TableRow key={bank.id}>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {bank.title}
                        </TableCell>
                        <TableCell className="text-sm">
                          {bank.uploader?.name || bank.uploader?.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{bank.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={getDifficultyColor(bank.difficulty)}
                          >
                            {getDifficultyLabel(bank.difficulty)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{bank._count.questions}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                          {bank.source}
                        </TableCell>
                        <TableCell>{renderStatusBadge(bank.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {bank.reviewer?.name || bank.reviewer?.email || "-"}
                        </TableCell>
                        <TableCell>
                          {bank.isPublic ? (
                            <Badge variant="success">公开</Badge>
                          ) : (
                            <Badge variant="secondary">隐藏</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {bank.createdAt ? formatDate(bank.createdAt) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {bank.status === "PENDING" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="开始审核"
                                onClick={() => handleViewDetail(bank.id, true)}
                                disabled={reviewing}
                              >
                                <PlayCircle className="mr-1 h-4 w-4 text-blue-600" />
                                审核
                              </Button>
                            )}
                            {bank.status === "REVIEWING" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="审核"
                                onClick={() => handleViewDetail(bank.id)}
                              >
                                <Eye className="mr-1 h-4 w-4" />
                                审核
                              </Button>
                            )}
                            {bank.status === "APPROVED" || bank.status === "REJECTED" || bank.status === "NEEDS_REVISION" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="查看详情"
                                  onClick={() => handleViewDetail(bank.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="重新审核"
                                  onClick={() => handleReReview(bank.id)}
                                  disabled={reReviewing}
                                >
                                  {reReviewing ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4 text-orange-500" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="查看详情"
                                onClick={() => handleViewDetail(bank.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title={bank.isPublic ? "隐藏" : "公开"}
                              disabled={managingId === bank.id}
                              onClick={() => handleTogglePublic(bank)}
                            >
                              {bank.isPublic ? (
                                <EyeOff className="h-4 w-4 text-orange-500" />
                              ) : (
                                <Globe className="h-4 w-4 text-blue-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="删除"
                              disabled={managingId === bank.id}
                              onClick={() => {
                                setDeleteBank(bank);
                                setDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    共 {pagination.total} 条，第 {pagination.page} / {pagination.totalPages} 页
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchBanks(pagination.page - 1)}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchBanks(pagination.page + 1)}
                    >
                      下一页
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={(open) => { setReviewOpen(open); if (!open) { setReviewBank(null); setReviewComment(""); setAiReviewResult(null); setAiReviewError(""); setAiReviewRaw(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>题库详情</DialogTitle>
            <DialogDescription>
              {reviewBank?.title}
            </DialogDescription>
          </DialogHeader>
          {reviewLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : reviewBank ? (
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm shrink-0">
                <div>
                  <Label className="text-xs text-muted-foreground">分类</Label>
                  <p>{reviewBank.category}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">难度</Label>
                  <Badge className={getDifficultyColor(reviewBank.difficulty)}>
                    {getDifficultyLabel(reviewBank.difficulty)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">上传者</Label>
                  <p>{reviewBank.uploader?.name || reviewBank.uploader?.email || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">状态</Label>
                  {renderStatusBadge(reviewBank.status)}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">来源</Label>
                  <p>{reviewBank.source}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">题目数</Label>
                  <p>{reviewBank.questions.length} 题</p>
                </div>
                {reviewBank.reviewedById && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">审核人</Label>
                    <p>{reviewBank.reviewer?.name || reviewBank.reviewer?.email || reviewBank.reviewedById}</p>
                  </div>
                )}
                {reviewBank.description && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">描述</Label>
                    <p className="text-sm">{reviewBank.description}</p>
                  </div>
                )}
                {reviewBank.tags && reviewBank.tags.length > 0 && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">标签</Label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {reviewBank.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {reviewBank.reviewComment && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">审核评语</Label>
                    <p className="text-sm text-orange-600">{reviewBank.reviewComment}</p>
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1 min-h-0 rounded-md border">
                <div className="space-y-4 p-4">
                  {reviewBank.questions.map((q, idx) => (
                    <div key={q.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="outline">
                          第 {idx + 1} 题 · {questionTypeLabels[q.type] || q.type}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{q.content}</p>
                      {q.image && (
                        <div className="mt-2">
                          <img
                            src={q.image}
                            alt="题目图片"
                            className="max-h-60 max-w-full rounded-md border object-contain"
                          />
                        </div>
                      )}
                      {q.options && q.options.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          {q.options.map((opt) => (
                            <div
                              key={opt.key}
                              className={`rounded border px-3 py-1.5 text-xs ${
                                opt.key === q.answer
                                  ? "border-green-300 bg-green-50 text-green-700"
                                  : "bg-muted/30"
                              }`}
                            >
                              <span className="font-medium">{opt.key}.</span> {opt.value}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.analysis && (
                        <div className="mt-2 rounded bg-muted/50 p-2 text-xs">
                          <span className="font-medium">解析:</span> {q.analysis}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {(reviewBank.status === "PENDING" || reviewBank.status === "REVIEWING") ? (
                <div className="space-y-3 shrink-0">
                  {templates.length > 0 && (
                    <div className="space-y-2">
                      <Label>审核模板</Label>
                      <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择审核模板..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">不使用模板</SelectItem>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAiReview}
                        disabled={aiReviewing}
                      >
                        {aiReviewing ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1 h-4 w-4" />
                        )}
                        AI 审核分析
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        使用 AI 分析题库答案正确性和题目质量
                      </span>
                    </div>

                    {aiReviewError && (
                      <p className="text-sm text-red-600">{aiReviewError}</p>
                    )}

                    {aiReviewResult && aiReviewResult.length > 0 && (
                      <div className="max-h-[200px] overflow-auto rounded-md border bg-muted/30 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-medium">AI 分析结果</h4>
                          <Badge variant={
                            aiReviewResult.filter((r: any) => r.hasIssue).length === 0
                              ? "success" : "warning"
                          }>
                            {aiReviewResult.filter((r: any) => r.hasIssue).length > 0
                              ? `${aiReviewResult.filter((r: any) => r.hasIssue).length} 个问题`
                              : "全部通过"}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {aiReviewResult.map((review: any, idx: number) => (
                            <div
                              key={idx}
                              className={`rounded border p-2 text-xs ${
                                review.hasIssue
                                  ? review.severity === "error"
                                    ? "border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800"
                                    : review.severity === "warning"
                                    ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800"
                                    : "border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
                                  : "border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                  第 {review.index} 题
                                </Badge>
                                {review.hasIssue ? (
                                  <Badge
                                    variant={
                                      review.severity === "error"
                                        ? "destructive"
                                        : review.severity === "warning"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="text-[10px]"
                                  >
                                    {review.severity === "error" ? "错误" : review.severity === "warning" ? "警告" : "提示"}
                                  </Badge>
                                ) : (
                                  <Badge variant="success" className="text-[10px]">通过</Badge>
                                )}
                              </div>
                              <p className="mt-1 font-medium">{review.message}</p>
                              {review.suggestion && (
                                <p className="mt-0.5 text-muted-foreground">建议: {review.suggestion}</p>
                              )}
                            </div>
                          ))}
                        </div>
                        {aiReviewRaw && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground">查看 AI 原始返回</summary>
                            <pre className="mt-2 max-h-[200px] overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{aiReviewRaw}</pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>审核评语</Label>
                    <Textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="输入审核评语..."
                      rows={2}
                    />
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleReview(reviewBank.id, "NEEDS_REVISION")}
                      disabled={reviewing}
                    >
                      <AlertTriangle className="mr-1 h-4 w-4 text-orange-500" />
                      需修改
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReview(reviewBank.id, "REJECTED")}
                      disabled={reviewing}
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      驳回
                    </Button>
                    <Button
                      onClick={() => handleReview(reviewBank.id, "APPROVED")}
                      disabled={reviewing}
                    >
                      <CheckCircle className="mr-1 h-4 w-4" />
                      通过
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="rounded-lg border p-4 shrink-0">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">审核结果：</span>
                      {renderStatusBadge(reviewBank.status)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReReview(reviewBank.id)}
                      disabled={reReviewing}
                    >
                      {reReviewing ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-1 h-4 w-4" />
                      )}
                      重新审核
                    </Button>
                  </div>
                  {reviewBank.reviewComment && (
                    <p className="text-sm text-muted-foreground">{reviewBank.reviewComment}</p>
                  )}
                  {reviewBank.reviewer && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      审核人：{reviewBank.reviewer.name || reviewBank.reviewer.email}
                      {reviewBank.reviewedAt && ` · ${formatDate(reviewBank.reviewedAt)}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">题库不存在</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除题库</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除题库 <strong>{deleteBank?.title}</strong> 吗？该题库下的所有题目和答题记录将被永久删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
