"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  RotateCw,
  Copy,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const actionLabels: Record<string, string> = {
  UPDATE_USER: "更新用户",
  DELETE_USER: "删除用户",
  BAN_USER: "封禁用户",
  UNBAN_USER: "解封用户",
  APPROVE_BANK: "通过题库",
  REJECT_BANK: "驳回题库",
  GENERATE_CODES: "生成激活码",
  DELETE_CODES: "删除激活码",
  UPDATE_SETTINGS: "更新设置",
  FORCE_ACTIVATE: "强制激活",
  LOGIN: "登录",
  LOGOUT: "退出",
  REGISTER: "注册",
  ACTIVATE: "激活",
  CREATE_BANK: "创建题库",
  DELETE_BANK: "删除题库",
};

const actionVariants: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  UPDATE_USER: "secondary",
  DELETE_USER: "destructive",
  BAN_USER: "destructive",
  UNBAN_USER: "success",
  APPROVE_BANK: "success",
  REJECT_BANK: "destructive",
  GENERATE_CODES: "default",
  DELETE_CODES: "destructive",
  UPDATE_SETTINGS: "secondary",
  FORCE_ACTIVATE: "warning",
  LOGIN: "outline",
  LOGOUT: "outline",
  REGISTER: "outline",
  ACTIVATE: "success",
  CREATE_BANK: "outline",
  DELETE_BANK: "destructive",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const fetchLogs = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (search) params.set("search", search);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLogs(data.logs || []);
      setActions(data.actions || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch {
      toast.error("加载日志失败");
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const formatDateStr = (d: Date) => d.toISOString().slice(0, 10);

  const setDatePreset = (preset: string) => {
    const today = new Date();
    if (preset === "today") {
      setDateFrom(formatDateStr(today));
      setDateTo(formatDateStr(today));
    } else if (preset === "7days") {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      setDateFrom(formatDateStr(d));
      setDateTo(formatDateStr(today));
    } else if (preset === "30days") {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      setDateFrom(formatDateStr(d));
      setDateTo(formatDateStr(today));
    } else if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    }
  };

  const handleCopyIp = (ip: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    toast.success("IP 已复制");
    setTimeout(() => setCopiedIp(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">操作日志</h1>
        <p className="text-sm text-muted-foreground">查看管理员操作记录和系统日志</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              操作日志
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchLogs(pagination.page)}
              disabled={loading}
            >
              <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索日志详情或用户名..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="操作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作</SelectItem>
                {actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {actionLabels[action] || action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[160px]"
              title="开始日期"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[160px]"
              title="结束日期"
            />
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatePreset("today")}
              >
                今天
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatePreset("7days")}
              >
                近7天
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatePreset("30days")}
              >
                近30天
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatePreset("all")}
              >
                全部
              </Button>
            </div>
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
                    <TableHead className="w-[180px]">时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
                    <TableHead>详情</TableHead>
                    <TableHead className="w-[160px]">IP</TableHead>
                    <TableHead className="w-[80px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        暂无日志记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailOpen(true);
                        }}
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {log.createdAt ? formatDate(log.createdAt) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.user ? (
                            <span>
                              {log.user.name}{" "}
                              <span className="text-muted-foreground">
                                ({log.user.email})
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">系统</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={actionVariants[log.action] || "outline"}
                            className="whitespace-nowrap"
                          >
                            {actionLabels[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">
                          {log.details || "-"}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {log.ip || "-"}
                            {log.ip && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => handleCopyIp(log.ip!, e)}
                              >
                                {copiedIp === log.ip ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            查看
                          </Button>
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
                      onClick={() => fetchLogs(pagination.page - 1)}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchLogs(pagination.page + 1)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">操作类型：</span>
                <Badge variant={actionVariants[selectedLog.action] || "outline"}>
                  {actionLabels[selectedLog.action] || selectedLog.action}
                </Badge>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">时间：</span>
                <span className="text-sm">
                  {selectedLog.createdAt
                    ? new Date(selectedLog.createdAt).toLocaleString("zh-CN")
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">用户：</span>
                <span className="text-sm">
                  {selectedLog.user
                    ? `${selectedLog.user.name} (${selectedLog.user.email})`
                    : "系统"}
                </span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">详情：</span>
                <p className="mt-1 whitespace-pre-wrap rounded bg-muted p-3 text-sm">
                  {selectedLog.details || "无"}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">IP 地址：</span>
                <code className="text-sm">{selectedLog.ip || "无"}</code>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">User Agent：</span>
                <p className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs text-muted-foreground">
                  {selectedLog.userAgent || "无"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
