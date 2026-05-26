"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReviewerStats {
  userId: string;
  userName: string;
  totalReviewed: number;
  totalApproved: number;
  totalRejected: number;
  totalNeedsRevision: number;
  avgReviewTime: number;
}

export default function ReviewerStatsPage() {
  const [stats, setStats] = useState<ReviewerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/reviewer-stats?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data.stats || []);
    } catch {
      toast.error("加载统计数据失败");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  const chartData = stats.map((s) => ({
    name: s.userName,
    通过: s.totalApproved,
    驳回: s.totalRejected,
    需修改: s.totalNeedsRevision,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">审核绩效</h1>
          <p className="text-sm text-muted-foreground">查看审核员的工作绩效统计</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="时间范围" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">最近 7 天</SelectItem>
            <SelectItem value="30">最近 30 天</SelectItem>
            <SelectItem value="90">最近 90 天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : stats.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无审核数据
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.userId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    {s.userName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{s.totalReviewed}</p>
                  <p className="text-xs text-muted-foreground">总审核数</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">审核对比</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="通过" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="驳回" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="需修改" fill="#ea580c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">审核明细</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>审核员</TableHead>
                    <TableHead className="text-right">总审核</TableHead>
                    <TableHead className="text-right">通过</TableHead>
                    <TableHead className="text-right">驳回</TableHead>
                    <TableHead className="text-right">需修改</TableHead>
                    <TableHead className="text-right">平均审核时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s) => (
                    <TableRow key={s.userId}>
                      <TableCell className="font-medium">{s.userName}</TableCell>
                      <TableCell className="text-right">{s.totalReviewed}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {s.totalApproved}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {s.totalRejected}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {s.totalNeedsRevision}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTime(s.avgReviewTime)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
