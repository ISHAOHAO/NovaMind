"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Ban,
  CheckCircle,
  Eye,
  Trash2,
  Shield,
  ChevronLeft,
  ChevronRight,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  isActivated: boolean;
  activatedAt: string | null;
  banned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserDetail extends User {
  deviceId: string | null;
  todayUsedSeconds: number;
  lastUsedDate: string | null;
  deletedAt: string | null;
  activationCode: {
    code: string;
    status: string;
    usedAt: string | null;
    expiresAt: string | null;
  } | null;
  _count: {
    uploads: number;
    records: number;
    favorites: number;
    notes: number;
    sessions: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const roleLabels: Record<string, string> = {
  USER: "用户",
  ADMIN: "管理员",
  SUPER_ADMIN: "超级管理员",
};

const roleVariants: Record<string, "default" | "secondary" | "outline"> = {
  USER: "outline",
  ADMIN: "secondary",
  SUPER_ADMIN: "default",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [bannedFilter, setBannedFilter] = useState("all");

  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [banUser, setBanUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banOpen, setBanOpen] = useState(false);

  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [roleUser, setRoleUser] = useState<User | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");

  const fetchUsers = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (bannedFilter !== "all") params.set("banned", bannedFilter);

      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data.users || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, bannedFilter]);

  useEffect(() => {
    fetchUsers(1);
    try {
      const userStr = localStorage.getItem("novamind_user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setCurrentUserRole(parsed.role || "");
      }
    } catch {
      // ignore
    }
  }, [fetchUsers]);

  const handleViewDetail = async (userId: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDetailUser(data.user || null);
    } catch {
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBan = async () => {
    if (!banUser || !banReason.trim()) return;
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${banUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ banned: true, bannedReason: banReason.trim() }),
      });
      if (res.ok) {
        setBanOpen(false);
        setBanUser(null);
        setBanReason("");
        fetchUsers(pagination.page);
      }
    } catch {
    }
  };

  const handleUnban = async (user: User) => {
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ banned: false }),
      });
      if (res.ok) {
        fetchUsers(pagination.page);
      }
    } catch {
    }
  };

  const handleForceActivate = async (user: User) => {
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActivated: true }),
      });
      if (res.ok) {
        fetchUsers(pagination.page);
      }
    } catch {
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDeleteOpen(false);
        setDeleteUser(null);
        fetchUsers(pagination.page);
      }
    } catch {
    }
  };

  const handleRoleChange = async () => {
    if (!roleUser || !newRole) return;
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${roleUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setRoleOpen(false);
        setRoleUser(null);
        setNewRole("");
        fetchUsers(pagination.page);
      } else {
        alert(data.error || "修改角色失败");
      }
    } catch {
      alert("网络错误，请稍后重试");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">用户管理</h1>
        <p className="text-sm text-muted-foreground">管理系统用户</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索用户邮箱或昵称..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="角色筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="USER">用户</SelectItem>
                <SelectItem value="ADMIN">管理员</SelectItem>
                <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bannedFilter} onValueChange={setBannedFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="封禁状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="false">正常</SelectItem>
                <SelectItem value="true">已封禁</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>激活状态</TableHead>
                    <TableHead>封禁状态</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        暂无用户数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={roleVariants[user.role] || "outline"}>
                            {roleLabels[user.role] || user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.isActivated ? (
                            <Badge variant="success">已激活</Badge>
                          ) : (
                            <Badge variant="warning">未激活</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.banned ? (
                            <Badge variant="destructive">已封禁</Badge>
                          ) : (
                            <Badge variant="outline">正常</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.createdAt ? formatDate(user.createdAt) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="查看详情"
                              onClick={() => handleViewDetail(user.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {user.banned ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="解封"
                                onClick={() => handleUnban(user)}
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="封禁"
                                onClick={() => {
                                  setBanUser(user);
                                  setBanReason("");
                                  setBanOpen(true);
                                }}
                              >
                                <Ban className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                            {!user.isActivated && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="强制激活"
                                onClick={() => handleForceActivate(user)}
                              >
                                <Shield className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="修改角色"
                              onClick={() => {
                                setRoleUser(user);
                                setNewRole("");
                                setRoleOpen(true);
                              }}
                            >
                              <UserCog className="h-4 w-4 text-purple-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="删除"
                              onClick={() => {
                                setDeleteUser(user);
                                setDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    共 {pagination.total} 条，第 {pagination.page} / {pagination.totalPages} 页
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchUsers(pagination.page - 1)}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchUsers(pagination.page + 1)}
                    >
                      下一页
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>用户详情</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : detailUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="text-lg">
                    {detailUser.name?.charAt(0) || detailUser.email?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{detailUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{detailUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">角色</Label>
                  <p>{roleLabels[detailUser.role] || detailUser.role}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">激活状态</Label>
                  <p>{detailUser.isActivated ? "已激活" : "未激活"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">封禁状态</Label>
                  <p>{detailUser.banned ? `已封禁 (${detailUser.bannedReason || "-"})` : "正常"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">最后登录</Label>
                  <p>{detailUser.lastLoginAt ? formatDate(detailUser.lastLoginAt) : "从未登录"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">最后 IP</Label>
                  <p>{detailUser.lastLoginIp || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">今日使用</Label>
                  <p>{Math.floor(detailUser.todayUsedSeconds / 60)} 分钟</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">注册时间</Label>
                  <p>{detailUser.createdAt ? formatDate(detailUser.createdAt) : "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">设备 ID</Label>
                  <p className="truncate font-mono text-xs">{detailUser.deviceId || "-"}</p>
                </div>
              </div>
              {detailUser.activationCode && (
                <div className="rounded-lg border p-3">
                  <Label className="text-xs text-muted-foreground">激活码信息</Label>
                  <p className="text-sm font-mono">{detailUser.activationCode.code}</p>
                  <p className="text-xs text-muted-foreground">
                    状态: {detailUser.activationCode.status} | 过期: {detailUser.activationCode.expiresAt ? formatDate(detailUser.activationCode.expiresAt) : "-"}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "上传题库", value: detailUser._count.uploads },
                  { label: "答题记录", value: detailUser._count.records },
                  { label: "收藏", value: detailUser._count.favorites },
                  { label: "笔记", value: detailUser._count.notes },
                  { label: "会话", value: detailUser._count.sessions },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border p-2">
                    <p className="text-lg font-bold">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">用户不存在</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>封禁用户</DialogTitle>
            <DialogDescription>
              封禁后该用户将无法登录和使用任何功能。请填写封禁原因。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">用户</Label>
              <p className="font-medium">
                {banUser?.name} ({banUser?.email})
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ban-reason">封禁原因</Label>
              <Textarea
                id="ban-reason"
                placeholder="请输入封禁原因..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleBan}
              disabled={!banReason.trim()}
            >
              确认封禁
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改角色</DialogTitle>
            <DialogDescription>
              为用户 {roleUser?.name} ({roleUser?.email}) 设置新的角色权限
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">当前角色</Label>
              <p className="font-medium">
                {roleUser ? (roleLabels[roleUser.role] || roleUser.role) : ""}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">新角色</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="new-role">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">用户</SelectItem>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                  {currentUserRole === "SUPER_ADMIN" && (
                    <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={!newRole || newRole === roleUser?.role}
            >
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除用户 {deleteUser?.name} ({deleteUser?.email}) 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
