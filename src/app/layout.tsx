import type { Metadata } from "next";
import { Suspense } from "react";
import Providers from "./providers";
import { Toaster } from "react-hot-toast";
import { LoadingScreen } from "@/components/ui/loading-screen";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaMind - 在线刷题平台",
  description: "智能刷题，高效学习",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background antialiased">
        <Providers>
          <Suspense fallback={<LoadingScreen message="正在加载..." />}>
            {children}
          </Suspense>
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
