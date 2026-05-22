import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return formatDate(date);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getDifficultyLabel(level: number): string {
  const labels: Record<number, string> = {
    1: "简单",
    2: "较易",
    3: "中等",
    4: "较难",
    5: "困难",
  };
  return labels[level] || "未知";
}

export function getDifficultyColor(level: number): string {
  const colors: Record<number, string> = {
    1: "text-green-600 bg-green-100",
    2: "text-emerald-600 bg-emerald-100",
    3: "text-yellow-600 bg-yellow-100",
    4: "text-orange-600 bg-orange-100",
    5: "text-red-600 bg-red-100",
  };
  return colors[level] || "text-gray-600 bg-gray-100";
}
