import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">页面不存在</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        您访问的页面可能已被移动或删除，请检查地址是否正确。
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/dashboard">回到首页</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/questions">浏览题库</Link>
        </Button>
      </div>
    </div>
  );
}
