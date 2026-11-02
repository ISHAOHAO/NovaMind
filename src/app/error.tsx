"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[页面错误]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h2 className="text-xl font-semibold">页面出错了</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        页面加载时发生意外错误，请重试。如果问题持续存在，请刷新页面或稍后再访问。
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重试
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          <Home className="mr-2 h-4 w-4" />
          回到首页
        </Button>
      </div>
    </div>
  );
}
