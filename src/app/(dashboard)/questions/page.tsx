"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadDifficulty, setUploadDifficulty] = useState("1");
  const [uploadTags, setUploadTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadError, setUploadError] = useState(false);

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

  const handlePageChange = (page: number) => {
    fetchBanks(page);
  };

  const handleUpload = async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    if (!uploadTitle.trim() || !uploadSource.trim() || !uploadCategory) {
      setUploadMsg("请填写必填字段");
      setUploadError(true);
      return;
    }
    setUploading(true);
    setUploadMsg("");
    setUploadError(false);
    try {
      const body = {
        title: uploadTitle.trim(),
        description: uploadDescription.trim(),
        source: uploadSource.trim(),
        category: uploadCategory,
        tags: uploadTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        difficulty: parseInt(uploadDifficulty),
        isPublic: true,
      };
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg(data.message || "题库创建成功");
        setUploadError(false);
        setUploadOpen(false);
        setUploadTitle("");
        setUploadDescription("");
        setUploadSource("");
        setUploadCategory("");
        setUploadDifficulty("1");
        setUploadTags("");
        fetchBanks(1);
      } else {
        setUploadMsg(data.error || "创建失败");
        setUploadError(true);
      }
    } catch {
      setUploadMsg("网络错误，请稍后重试");
      setUploadError(true);
    } finally {
      setUploading(false);
    }
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
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/questions/${bank.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-1">{bank.title}</CardTitle>
                    <Badge className={cn("ml-2 shrink-0", getDifficultyColor(bank.difficulty))}>
                      {bank.difficultyLabel}
                    </Badge>
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
        onClick={() => setUploadOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>上传新题库</DialogTitle>
            <DialogDescription>填写题库信息，上传后可能需要审核</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="utitle">题库名称 *</Label>
              <Input
                id="utitle"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="输入题库名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="udesc">描述</Label>
              <Textarea
                id="udesc"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="题库描述（可选）"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usource">题库来源说明 *</Label>
              <Input
                id="usource"
                value={uploadSource}
                onChange={(e) => setUploadSource(e.target.value)}
                placeholder="如：原创、教材、考试真题等"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类 *</Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>难度</Label>
                <Select value={uploadDifficulty} onValueChange={setUploadDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {difficulties.filter((d) => d.value !== "all").map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="utags">标签（逗号分隔）</Label>
              <Input
                id="utags"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="如：JavaScript, React, 前端"
              />
            </div>
            {uploadMsg && (
              <p className={`text-sm ${uploadError ? "text-red-600" : "text-green-600"}`}>
                {uploadMsg}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "上传中..." : "上传题库"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
