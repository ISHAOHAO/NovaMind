"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Star, ChevronLeft, ChevronRight, Play, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getDifficultyColor } from "@/lib/utils";

interface FavoriteItem {
  id: string;
  favoritedAt: string;
  question: {
    id: string;
    type: string;
    content: string;
    bank: {
      id: string;
      title: string;
      difficulty: number;
      difficultyLabel: string;
    } | null;
    createdAt: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function questionTypeLabel(type: string): string {
  switch (type) {
    case "single":
      return "单选题";
    case "multiple":
      return "多选题";
    case "truefalse":
      return "判断题";
    case "fillblank":
      return "填空题";
    case "cloze":
      return "完形填空";
    default:
      return type;
  }
}

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchFavorites = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/questions/favorites?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.data || []);
        setPagination(
          data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
        );
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, router]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">我的收藏</h1>
        <p className="text-sm text-muted-foreground">
          收藏的题目可能来自不同题库，点击每行的「去练习」可跳转到对应题库并定位该题
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">收藏列表（共 {pagination.total} 题）</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Star className="mb-3 h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">暂无收藏题目</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                在练习页面点击题目右上角的心形按钮即可收藏
              </p>
              <Button variant="link" onClick={() => router.push("/questions")}>
                去题库列表刷题
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.map((fav) => (
                <Card key={fav.id} className="transition-colors hover:bg-accent/30">
                  <CardContent className="flex items-start gap-3 p-4">
                    <Star className="mt-0.5 h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{questionTypeLabel(fav.question.type)}</Badge>
                        {fav.question.bank && (
                          <Badge variant="secondary">{fav.question.bank.title}</Badge>
                        )}
                        {fav.question.bank && (
                          <Badge className={cn("text-[10px]", getDifficultyColor(fav.question.bank.difficulty))}>
                            {fav.question.bank.difficultyLabel}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          收藏于 {fav.favoritedAt}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm">{fav.question.content}</p>
                    </div>
                    {fav.question.bank && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 shrink-0"
                        onClick={() =>
                          router.push(
                            `/questions/${fav.question.bank!.id}?questionId=${fav.question.id}`
                          )
                        }
                      >
                        <Play className="mr-1 h-3.5 w-3.5" />
                        去练习
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                第 {pagination.page} / {pagination.totalPages} 页
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
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                  <ChevronRight className="mr-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" />
        练习时已收藏的题目会显示红心，可随时在这里回访
      </div>
    </div>
  );
}
