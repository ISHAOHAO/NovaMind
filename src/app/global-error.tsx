"use client";

import { useEffect } from "react";

/** 根布局级错误兜底：layout 本身崩溃时渲染（需自带 html/body） */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[全局错误]", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            应用出现严重错误
          </h1>
          <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
            请刷新页面重试，如果问题持续存在请联系管理员。
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
