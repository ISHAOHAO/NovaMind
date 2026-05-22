"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Plus,
  Copy,
  Download,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate } from "@/lib/utils";

interface ActivationCode {
  id: string;
  code: string;
  prefix: string;
  batchId: string;
  duration: number;
  isUsed: boolean;
  status: string;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  usedBy: {
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

const statusLabels: Record<string, string> = {
  UNUSED: "未使用",
  USED: "已使用",
  EXPIRED: "已过期",
};

const statusVariants: Record<string, "success" | "secondary" | "destructive" | "outline"> = {
  UNUSED: "success",
  USED: "secondary",
  EXPIRED: "destructive",
};

export default function ActivationCodesPage() {
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [generateOpen, setGenerateOpen] = useState(false);
  const [genPrefix, setGenPrefix] = useState("NOVA");
  const [genCount, setGenCount] = useState(10);
  const [genDuration, setGenDuration] = useState(30);
  const [generating, setGenerating] = useState(false);

  const [generatedCodes, setGeneratedCodes] = useState<{ count: number; prefix: string; batchId: string } | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const fetchCodes = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/activation-codes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCodes(data.codes || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCodes(1);
  }, [fetchCodes]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/admin/activation-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prefix: genPrefix,
          count: genCount,
          duration: genDuration,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedCodes(data);
        setGenerateOpen(false);
        fetchCodes(1);
      } else {
        alert(data.error || "生成失败");
      }
    } catch {
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/admin/activation-codes/export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `activation-codes-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const durationPresets = [
    { label: "7 天", value: 7 },
    { label: "15 天", value: 15 },
    { label: "30 天", value: 30 },
    { label: "90 天", value: 90 },
    { label: "180 天", value: 180 },
    { label: "365 天", value: 365 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">激活码管理</h1>
        <p className="text-sm text-muted-foreground">生成和管理激活码</p>
      </div>

      {generatedCodes && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-green-800">
                  成功生成 {generatedCodes.count} 个激活码
                </p>
                <p className="text-sm text-green-700">
                  前缀: {generatedCodes.prefix} | 批次: {generatedCodes.batchId}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGeneratedCodes(null)}
              >
                <Check className="mr-1 h-4 w-4" />
                知道了
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">激活码列表</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-1 h-4 w-4" />
                导出 CSV
              </Button>
              <Button size="sm" onClick={() => setGenerateOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                生成激活码
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索激活码..."
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
                <SelectItem value="UNUSED">未使用</SelectItem>
                <SelectItem value="USED">已使用</SelectItem>
                <SelectItem value="EXPIRED">已过期</SelectItem>
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
                    <TableHead>激活码</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>使用者</TableHead>
                    <TableHead>使用时间</TableHead>
                    <TableHead>过期时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        暂无激活码数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    codes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                            {code.code}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariants[code.status] || "outline"}>
                            {statusLabels[code.status] || code.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{code.duration} 天</TableCell>
                        <TableCell className="text-sm">
                          {code.usedBy ? `${code.usedBy.name} (${code.usedBy.email})` : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {code.usedAt ? formatDate(code.usedAt) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {code.expiresAt ? formatDate(code.expiresAt) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyCode(code.code)}
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            复制
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
                      onClick={() => fetchCodes(pagination.page - 1)}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchCodes(pagination.page + 1)}
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

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成激活码</DialogTitle>
            <DialogDescription>
              输入参数批量生成激活码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prefix">前缀</Label>
              <Input
                id="prefix"
                value={genPrefix}
                onChange={(e) => setGenPrefix(e.target.value.toUpperCase())}
                placeholder="NOVA"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                激活码格式: {genPrefix}-XXXXXXXXXXXX
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="count">生成数量</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={1000}
                value={genCount}
                onChange={(e) => setGenCount(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
              />
              <div className="flex gap-2">
                {[10, 50, 100, 500].map((n) => (
                  <Button
                    key={n}
                    variant="outline"
                    size="sm"
                    onClick={() => setGenCount(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>有效期</Label>
              <div className="flex flex-wrap gap-2">
                {durationPresets.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={genDuration === preset.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGenDuration(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={genDuration}
                  onChange={(e) => setGenDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">天</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                "确认生成"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
