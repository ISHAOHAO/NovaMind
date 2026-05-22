"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Separator } from "@/components/ui/separator";
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
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { questions: number };
  uploader: { id: string; email: string; name: string } | null;
  reviewedBy: { id: string; email: string; name: string } | null;
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

const statusVariants: Record<string, "warning" | "success" | "destructive" | "outline"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

const questionTypeLabels: Record<string, string> = {
  single: "单选题",
  multiple: "多选题",
  truefalse: "判断题",
  fillblank: "填空题",
  cloze: "完形填空",
};

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

  const [reviewBank, setReviewBank] = useState<BankDetail | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const [deleteBank, setDeleteBank] = useState<QuestionBank | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);

  const fetchBanks = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/questions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBanks(data.banks || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchBanks(1);
  }, [fetchBanks]);

  const handleViewDetail = async (bankId: string) => {
    setReviewLoading(true);
    setReviewOpen(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/questions/${bankId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReviewBank(data.bank || null);
    } catch {
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReview = async (bankId: string, status: string, comment?: string) => {
    setReviewing(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/questions/${bankId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, comment }),
      });
      if (res.ok) {
        setReviewOpen(false);
        setRejectDialogOpen(false);
        setRejectReason("");
        setReviewBank(null);
        fetchBanks(pagination.page);
      } else {
        const data = await res.json();
        alert(data.error || "操作失败");
      }
    } catch {
    } finally {
      setReviewing(false);
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
        setDeleteOpen(false);
        setDeleteBank(null);
        fetchBanks(pagination.page);
      } else {
        const data = await res.json();
        alert(data.error || "删除失败");
      }
    } catch {
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
        fetchBanks(pagination.page);
      } else {
        const data = await res.json();
        alert(data.error || "操作失败");
      }
    } catch {
    } finally {
      setManagingId(null);
    }
  };

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
                <SelectItem value="APPROVED">已通过</SelectItem>
                <SelectItem value="REJECTED">已驳回</SelectItem>
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
                    <TableHead>公开</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
                        暂无需审核的题库
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
                        <TableCell>
                          <Badge variant={statusVariants[bank.status] || "outline"}>
                            {statusLabels[bank.status] || bank.status}
                          </Badge>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              title="查看详情"
                              onClick={() => handleViewDetail(bank.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {bank.status === "PENDING" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="审核通过"
                                  onClick={() => handleReview(bank.id, "APPROVED")}
                                  disabled={reviewing}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="驳回"
                                  onClick={() => {
                                    handleViewDetail(bank.id).then(() => {
                                      setRejectDialogOpen(true);
                                    });
                                  }}
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
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

      <Dialog open={reviewOpen} onOpenChange={(open) => { setReviewOpen(open); if (!open) setReviewBank(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
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
                  <Badge variant={statusVariants[reviewBank.status] || "outline"}>
                    {statusLabels[reviewBank.status] || reviewBank.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">来源</Label>
                  <p>{reviewBank.source}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">题目数</Label>
                  <p>{reviewBank.questions.length} 题</p>
                </div>
                {reviewBank.description && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">描述</Label>
                    <p className="text-sm">{reviewBank.description}</p>
                  </div>
                )}
                {reviewBank.reviewComment && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">审核评语</Label>
                    <p className="text-sm text-orange-600">{reviewBank.reviewComment}</p>
                  </div>
                )}
              </div>

              <ScrollArea className="h-[400px] rounded-md border">
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

              {reviewBank.status === "PENDING" && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReviewOpen(false);
                      setRejectReason("");
                      setRejectDialogOpen(true);
                    }}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    驳回
                  </Button>
                  <Button
                    onClick={() => handleReview(reviewBank.id, "APPROVED")}
                    disabled={reviewing}
                  >
                    <CheckCircle className="mr-1 h-4 w-4" />
                    审核通过
                  </Button>
                </DialogFooter>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">题库不存在</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回题库</DialogTitle>
            <DialogDescription>
              请填写驳回原因，用户将看到此说明。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">驳回原因</Label>
            <Textarea
              id="reject-reason"
              placeholder="请输入驳回原因..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("");
              }}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (reviewBank && rejectReason.trim()) {
                  handleReview(reviewBank.id, "REJECTED", rejectReason.trim());
                }
              }}
              disabled={!rejectReason.trim() || reviewing}
            >
              确认驳回
            </Button>
          </DialogFooter>
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
