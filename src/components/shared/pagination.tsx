"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

/** 通用分页：共 X 条，第 X/Y 页 + 上一页/下一页 + 页码按钮（总页数>5 时显示当前页±2）+ 页码跳转 */
export function SharedPagination({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationProps) {
  const [jumpValue, setJumpValue] = useState("");

  if (totalPages <= 1) return null;

  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>([1, totalPages, page]);
    for (let p = page - 2; p <= page + 2; p++) {
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
    const sorted = Array.from(pages).sort((a, b) => a - b);
    const result: (number | "ellipsis")[] = [];
    sorted.forEach((p, idx) => {
      if (idx === 0) {
        result.push(p);
        return;
      }
      const prev = sorted[idx - 1];
      if (p - prev > 1) result.push("ellipsis");
      result.push(p);
    });
    return result;
  };

  const handleJump = () => {
    const target = parseInt(jumpValue, 10);
    if (Number.isNaN(target)) return;
    const clamped = Math.min(totalPages, Math.max(1, target));
    if (clamped !== page) onPageChange(clamped);
    setJumpValue("");
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        共 {total} 条，第 {page} / {totalPages} 页
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          上一页
        </Button>
        {getPageNumbers().map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="sm"
              className="min-w-[32px] px-2"
              disabled={p === page}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
        {totalPages > 5 && (
          <div className="ml-2 flex items-center gap-1">
            <Input
              className="h-8 w-14 text-sm"
              placeholder="页码"
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJump();
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!jumpValue}
              onClick={handleJump}
            >
              跳转
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
