"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
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
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">操作日志</h1>
        <p className="text-sm text-muted-foreground">查看管理员操作记录和系统日志</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            操作日志
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
                    <TableHead className="w-[140px]">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        暂无日志记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
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
                          {log.ip || "-"}
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
    </div>
  );
}
