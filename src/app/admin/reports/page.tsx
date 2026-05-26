"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Eye,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatDate } from "@/lib/utils";

interface Report {
  id: string;
  reporterId: string;
  questionBankId: string;
  questionId: string | null;
  reason: string;
  status: string;
  handledById: string | null;
  handledAt: string | null;
  handleNote: string | null;
  createdAt: string;
  reporter: { id: string; email: string; name: string } | null;
  questionBank: { id: string; title: string } | null;
  question: { id: string; content: string } | null;
  handler: { id: string; email: string; name: string } | null;
}

const statusLabels: Record<string, string> = {
  PENDING: "待处理",
  RESOLVED: "已处理",
  DISMISSED: "已驳回",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  RESOLVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  DISMISSED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailReport, setDetailReport] = useState<Report | null>(null);

  const [handleOpen, setHandleOpen] = useState(false);
  const [handleReport, setHandleReport] = useState<Report | null>(null);
  const [handleNote, setHandleNote] = useState("");
  const [handling, setHandling] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReports(data.reports || []);
      const pag = data.pagination || {};
      setTotalPages(pag.totalPages || 0);
      setTotal(pag.total || 0);
    } catch {
      toast.error("加载反馈列表失败");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleResolve = async (report: Report, status: string) => {
    setHandling(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/admin/reports", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: report.id, status, handleNote }),
      });
      if (res.ok) {
        toast.success(status === "RESOLVED" ? "已标记为已处理" : "已驳回反馈");
        setHandleOpen(false);
        setHandleNote("");
        fetchReports();
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setHandling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">反馈管理</h1>
        <p className="text-sm text-muted-foreground">处理用户提交的题目反馈和反馈</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">反馈列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="PENDING">待处理</SelectItem>
                <SelectItem value="RESOLVED">已处理</SelectItem>
                <SelectItem value="DISMISSED">已驳回</SelectItem>
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
                    <TableHead>反馈人</TableHead>
                    <TableHead>题库</TableHead>
                    <TableHead>题目</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>处理人</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        暂无反馈
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="text-sm">
                          {report.reporter?.name || report.reporter?.email || "-"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm">
                          {report.questionBank?.title || "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {report.question ? (report.question.content?.slice(0, 40) + "...") : "整个题库"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {report.reason}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[report.status] || ""}>
                            {statusLabels[report.status] || report.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {report.handler?.name || report.handler?.email || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {report.createdAt ? formatDate(report.createdAt) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="查看详情"
                              onClick={() => {
                                setDetailReport(report);
                                setDetailOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {report.status === "PENDING" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="标记已处理"
                                  onClick={() => {
                                    setHandleReport(report);
                                    setHandleNote("");
                                    setHandleOpen(true);
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    共 {total} 条，第 {page} / {totalPages} 页
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>反馈详情</DialogTitle>
          </DialogHeader>
          {detailReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">反馈人</Label>
                  <p>{detailReport.reporter?.name || detailReport.reporter?.email || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">状态</Label>
                  <Badge className={statusColors[detailReport.status] || ""}>
                    {statusLabels[detailReport.status] || detailReport.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">题库</Label>
                  <p>{detailReport.questionBank?.title || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">题目</Label>
                  <p className="text-sm text-muted-foreground">
                    {detailReport.question
                      ? detailReport.question.content?.slice(0, 80)
                      : "整个题库"}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">反馈原因</Label>
                  <p className="text-sm mt-1">{detailReport.reason}</p>
                </div>
                {detailReport.handleNote && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">处理备注</Label>
                    <p className="text-sm mt-1">{detailReport.handleNote}</p>
                  </div>
                )}
                {detailReport.handler && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">处理人</Label>
                    <p className="text-sm">
                      {detailReport.handler.name || detailReport.handler.email}
                      {detailReport.handledAt && ` · ${formatDate(detailReport.handledAt)}`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={handleOpen} onOpenChange={setHandleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>处理反馈</DialogTitle>
            <DialogDescription>
              反馈题库：{handleReport?.questionBank?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">反馈原因</Label>
              <p className="text-sm mt-1">{handleReport?.reason}</p>
            </div>
            <div className="space-y-2">
              <Label>处理备注</Label>
              <Textarea
                value={handleNote}
                onChange={(e) => setHandleNote(e.target.value)}
                placeholder="输入处理备注..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleResolve(handleReport!, "DISMISSED")}
              disabled={handling}
            >
              <XCircle className="mr-1 h-4 w-4 text-red-500" />
              驳回反馈
            </Button>
            <Button
              onClick={() => handleResolve(handleReport!, "RESOLVED")}
              disabled={handling}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              标记已处理
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
