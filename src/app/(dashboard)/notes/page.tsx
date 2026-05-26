"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Star,
  Download,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDate } from "@/lib/utils";

interface Note {
  id: string;
  questionId: string;
  content: string;
  importance: number;
  isAiGenerated: boolean;
  question: {
    id: string;
    type: string;
    content: string;
    bank: {
      id: string;
      title: string;
      category: string;
      difficulty: number;
      difficultyLabel: string;
    } | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface NotesResponse {
  data: Note[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importanceFilter, setImportanceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [tab, setTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [updatingImportance, setUpdatingImportance] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (importanceFilter !== "all") params.set("importance", importanceFilter);

      if (tab === "high") {
        params.set("importance", "5");
      } else if (tab === "ai") {
        params.set("isAiGenerated", "true");
      }

      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/questions/notes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: NotesResponse = await res.json();
      setNotes(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [page, search, importanceFilter, tab]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    setPage(1);
  }, [search, importanceFilter, tab]);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/questions/notes?limit=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return {
        total: data.total || 0,
        highCount: data.data?.filter((n: Note) => n.importance >= 4).length || 0,
        aiCount: data.data?.filter((n: Note) => n.isAiGenerated).length || 0,
      };
    } catch {
      return { total: 0, highCount: 0, aiCount: 0 };
    }
  }, []);

  const [stats, setStats] = useState({ total: 0, highCount: 0, aiCount: 0 });
  useEffect(() => {
    fetchStats().then(setStats);
  }, [fetchStats, notes.length]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === notes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notes.map((n) => n.id)));
    }
  };

  const handleAiSummary = async () => {
    if (selectedIds.size === 0) return;
    setSummaryLoading(true);
    setSummaryOpen(true);
    setSummary("");
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/notes/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ noteIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary);
        fetchNotes();
      } else {
        setSummary(`<p style="color:red;">错误: ${data.error}</p>`);
      }
    } catch {
      setSummary(`<p style="color:red;">请求失败</p>`);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleExport = () => {
    const ids = Array.from(selectedIds);
    const query = ids.length > 0 ? `?noteIds=${ids.join(",")}` : "";
    const token = localStorage.getItem("novamind_token");

    fetch(`/api/notes/export${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "notes-export.md";
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const handleImportanceChange = async (noteId: string, importance: number) => {
    setUpdatingImportance(noteId);
    try {
      const token = localStorage.getItem("novamind_token");
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      await fetch("/api/questions/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId: note.questionId,
          content: note.content,
          importance,
        }),
      });
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, importance } : n))
      );
    } catch {
    } finally {
      setUpdatingImportance(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">笔记管理</h1>
        <p className="text-sm text-muted-foreground">管理和回顾你的学习笔记</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">总笔记数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">高重要笔记</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {notes.filter((n) => n.importance >= 4).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">AI 生成笔记</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {notes.filter((n) => n.isAiGenerated).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">笔记列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">全部笔记</TabsTrigger>
                <TabsTrigger value="high">高重要性</TabsTrigger>
                <TabsTrigger value="ai">AI 笔记</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索笔记内容..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={importanceFilter} onValueChange={setImportanceFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="重要性" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部重要性</SelectItem>
                  <SelectItem value="5">★★★★★</SelectItem>
                  <SelectItem value="4">★★★★</SelectItem>
                  <SelectItem value="3">★★★</SelectItem>
                  <SelectItem value="2">★★</SelectItem>
                  <SelectItem value="1">★</SelectItem>
                  <SelectItem value="0">无</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleAiSummary}
                disabled={selectedIds.size === 0 || summaryLoading}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                AI 总结 ({selectedIds.size})
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-1 h-4 w-4" />
                导出
                {selectedIds.size > 0 ? ` (${selectedIds.size})` : "全部"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={notes.length > 0 && selectedIds.size === notes.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">全选</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : notes.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">暂无笔记</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <Card
                    key={note.id}
                    className={cn(
                      "transition-colors",
                      selectedIds.has(note.id) && "ring-2 ring-primary"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIds.has(note.id)}
                          onCheckedChange={() => handleToggleSelect(note.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {note.question.bank && (
                              <Badge variant="outline">
                                {note.question.bank.title}
                              </Badge>
                            )}
                            {note.question.bank?.category && (
                              <Badge variant="secondary" className="text-xs">
                                {note.question.bank.category}
                              </Badge>
                            )}
                            {note.isAiGenerated && (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                AI
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                            {note.question.content}
                          </p>
                          <p className="text-sm whitespace-pre-wrap line-clamp-2">
                            {note.content}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  className={cn(
                                    "h-4 w-4 transition-colors",
                                    star <= note.importance
                                      ? "text-yellow-500"
                                      : "text-muted-foreground/30",
                                    updatingImportance === note.id && "animate-pulse"
                                  )}
                                  onClick={() =>
                                    handleImportanceChange(
                                      note.id,
                                      star === note.importance ? 0 : star
                                    )
                                  }
                                  disabled={updatingImportance === note.id}
                                >
                                  <Star
                                    className="h-4 w-4"
                                    fill={
                                      star <= note.importance
                                        ? "currentColor"
                                        : "none"
                                    }
                                  />
                                </button>
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {note.updatedAt}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
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
          </div>
        </CardContent>
      </Card>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI 笔记总结
            </DialogTitle>
            <DialogDescription>
              基于 {selectedIds.size} 条笔记生成的知识点总结
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {summaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: summary }}
              />
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
