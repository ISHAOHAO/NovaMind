"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  UserPlus,
  KeyRound,
  Pencil,
  MailCheck,
  MailX,
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
import toast from "react-hot-toast";
import { handleApiError, getToken } from "@/lib/api-client";

interface User {
  id: string;
  email: string;
  username: string | null;
  name: string;
  avatar: string | null;
  role: string;
  isActivated: boolean;
  emailVerified: boolean;
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
    page: 1, limit: 20, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [bannedFilter, setBannedFilter] = useState("all");
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState("all");
  const [activationFilter, setActivationFilter] = useState("all");
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null);
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchUsers = useCallback(async (page: number, searchVal?: string, roleVal?: string, banVal?: string, emailVal?: string, activationVal?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      const s = searchVal ?? search;
      const r = roleVal ?? roleFilter;
      const b = banVal ?? bannedFilter;
      const e = emailVal ?? emailVerifiedFilter;
      const a = activationVal ?? activationFilter;
      if (s) params.set("search", s);
      if (r !== "all") params.set("role", r);
      if (b !== "all") params.set("banned", b);
      if (e !== "all") params.set("emailVerified", e);
      if (a !== "all") params.set("isActivated", a);

      const token = getToken();
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data.users || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err) {
      handleApiError(err, "获取用户列表失败");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, bannedFilter, emailVerifiedFilter, activationFilter]);

  useEffect(() => {
    fetchUsers(1);
    try {
      const userStr = localStorage.getItem("novamind_user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setCurrentUserRole(parsed.role || "");
      }
    } catch {
      setCurrentUserRole("");
    }
  }, [fetchUsers]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchUsers(1, value, roleFilter, bannedFilter, emailVerifiedFilter, activationFilter);
    }, 300);
  };

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
      toast.error("获取用户详情失败");
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ banned: true, bannedReason: banReason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("用户已封禁");
        setBanOpen(false);
        setBanUser(null);
        setBanReason("");
        fetchUsers(pagination.page);
      } else {
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleUnban = async (user: User) => {
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ banned: false }),
      });
      if (res.ok) {
        toast.success("已解除封禁");
        fetchUsers(pagination.page);
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleForceActivate = async (user: User) => {
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActivated: true }),
      });
      if (res.ok) {
        toast.success("用户已激活");
        fetchUsers(pagination.page);
      }
    } catch {
      toast.error("网络错误");
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
      const data = await res.json();
      if (res.ok) {
        toast.success("用户已删除");
        setDeleteOpen(false);
        setDeleteUser(null);
        fetchUsers(pagination.page);
      } else {
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleRoleChange = async () => {
    if (!roleUser || !newRole) return;
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${roleUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("角色修改成功");
        setRoleOpen(false);
        setRoleUser(null);
        setNewRole("");
        fetchUsers(pagination.page);
      } else {
        toast.error(data.error || "修改失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleEditSave = async () => {
    if (!editUser || !editName.trim()) return;
    try {
      const token = localStorage.getItem("novamind_token");
      const body: Record<string, unknown> = { name: editName.trim() };
      if (typeof editUser.emailVerified === "boolean") {
        body.emailVerified = editUser.emailVerified;
      }
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("用户信息已更新");
        setEditOpen(false);
        setEditUser(null);
        fetchUsers(pagination.page);
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleToggleEmailVerified = async (user: User) => {
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emailVerified: !user.emailVerified }),
      });
      if (res.ok) {
        toast.success(user.emailVerified ? "已取消邮箱验证" : "邮箱已标记为已验证");
        fetchUsers(pagination.page);
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdUser || newPassword.length < 6) return;
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/users/${resetPwdUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        toast.success("密码已重置");
        setResetPwdOpen(false);
        setResetPwdUser(null);
        setNewPassword("");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-sm text-muted-foreground">管理系统用户</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          创建用户
        </Button>
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
                placeholder="搜索用户名/邮箱/昵称..."
                className="pl-9"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[130px]">
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
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="封禁状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="false">正常</SelectItem>
                <SelectItem value="true">已封禁</SelectItem>
              </SelectContent>
            </Select>
            <Select value={emailVerifiedFilter} onValueChange={setEmailVerifiedFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="邮箱验证" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="true">已验证</SelectItem>
                <SelectItem value="false">未验证</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activationFilter} onValueChange={setActivationFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="激活状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="true">已激活</SelectItem>
                <SelectItem value="false">未激活</SelectItem>
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
                    <TableHead>用户名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>激活</TableHead>
                    <TableHead>邮箱验证</TableHead>
                    <TableHead>最后登录</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        暂无用户数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs">
                                {(user.name || user.email).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">{user.username || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleVariants[user.role] || "outline"} className="text-xs">
                            {roleLabels[user.role] || user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.isActivated ? (
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs">已激活</Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 text-xs">未激活</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.emailVerified ? (
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs">已验证</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-xs">未验证</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.lastLoginAt ? formatDate(user.lastLoginAt) : "从未登录"}
                        </TableCell>
                        <TableCell>
                          {user.banned ? (
                            <Badge variant="destructive" className="text-xs">已封禁</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">正常</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.createdAt ? formatDate(user.createdAt) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="查看详情" onClick={() => handleViewDetail(user.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="编辑" onClick={() => { setEditUser(user); setEditName(user.name); setEditOpen(true); }}>
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            {user.banned ? (
                              <Button variant="ghost" size="icon" title="解封" onClick={() => handleUnban(user)}>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" title="封禁" onClick={() => { setBanUser(user); setBanReason(""); setBanOpen(true); }}>
                                <Ban className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" title={user.emailVerified ? "取消验证" : "标记已验证"} onClick={() => handleToggleEmailVerified(user)}>
                              {user.emailVerified ? <MailX className="h-4 w-4 text-yellow-600" /> : <MailCheck className="h-4 w-4 text-green-600" />}
                            </Button>
                            <Button variant="ghost" size="icon" title="重置密码" onClick={() => { setResetPwdUser(user); setNewPassword(""); setResetPwdOpen(true); }}>
                              <KeyRound className="h-4 w-4 text-orange-600" />
                            </Button>
                            {!user.isActivated && (
                              <Button variant="ghost" size="icon" title="强制激活" onClick={() => handleForceActivate(user)}>
                                <Shield className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" title="修改角色" onClick={() => { setRoleUser(user); setNewRole(""); setRoleOpen(true); }}>
                              <UserCog className="h-4 w-4 text-purple-600" />
                            </Button>
                            <Button variant="ghost" size="icon" title="删除" onClick={() => { setDeleteUser(user); setDeleteOpen(true); }}>
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
                    <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchUsers(pagination.page - 1)}>
                      <ChevronLeft className="mr-1 h-4 w-4" />上一页
                    </Button>
                    <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchUsers(pagination.page + 1)}>
                      下一页<ChevronRight className="ml-1 h-4 w-4" />
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
              {[1, 2, 3, 4, 5].map((i) => (<Skeleton key={i} className="h-6 w-full" />))}
            </div>
          ) : detailUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="text-lg">
                    {(detailUser.name || detailUser.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{detailUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{detailUser.email}</p>
                  {detailUser.username && <p className="text-xs text-muted-foreground font-mono">@{detailUser.username}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs text-muted-foreground">角色</Label><p>{roleLabels[detailUser.role] || detailUser.role}</p></div>
                <div><Label className="text-xs text-muted-foreground">激活状态</Label><p>{detailUser.isActivated ? "已激活" : "未激活"}</p></div>
                <div><Label className="text-xs text-muted-foreground">邮箱验证</Label><p>{detailUser.emailVerified ? "已验证" : "未验证"}</p></div>
                <div><Label className="text-xs text-muted-foreground">封禁状态</Label><p>{detailUser.banned ? `已封禁 (${detailUser.bannedReason || "-"})` : "正常"}</p></div>
                <div><Label className="text-xs text-muted-foreground">最后登录</Label><p>{detailUser.lastLoginAt ? formatDate(detailUser.lastLoginAt) : "从未登录"}</p></div>
                <div><Label className="text-xs text-muted-foreground">最后 IP</Label><p className="font-mono text-xs">{detailUser.lastLoginIp || "-"}</p></div>
                <div><Label className="text-xs text-muted-foreground">今日使用</Label><p>{Math.floor(detailUser.todayUsedSeconds / 60)} 分钟</p></div>
                <div><Label className="text-xs text-muted-foreground">注册时间</Label><p>{detailUser.createdAt ? formatDate(detailUser.createdAt) : "-"}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">设备 ID</Label><p className="truncate font-mono text-xs">{detailUser.deviceId || "-"}</p></div>
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
              <div className="grid grid-cols-5 gap-2 text-center">
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改 {editUser?.name} 的基本信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">昵称</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="输入昵称" />
            </div>
            {editUser && (
              <div className="space-y-2">
                <Label>邮箱验证状态</Label>
                <div className="flex gap-2">
                  <Button variant={editUser.emailVerified ? "default" : "outline"} size="sm" onClick={() => setEditUser({ ...editUser, emailVerified: true })}>
                    <MailCheck className="mr-1 h-3 w-3" />已验证
                  </Button>
                  <Button variant={!editUser.emailVerified ? "default" : "outline"} size="sm" onClick={() => setEditUser({ ...editUser, emailVerified: false })}>
                    <MailX className="mr-1 h-3 w-3" />未验证
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleEditSave} disabled={!editName.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>封禁用户</DialogTitle>
            <DialogDescription>封禁后该用户将无法登录和使用任何功能。请填写封禁原因。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">用户</Label>
              <p className="font-medium">{banUser?.name} ({banUser?.email})</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ban-reason">封禁原因</Label>
              <Textarea id="ban-reason" placeholder="请输入封禁原因..." value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleBan} disabled={!banReason.trim()}>确认封禁</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改角色</DialogTitle>
            <DialogDescription>为用户 {roleUser?.name} ({roleUser?.email}) 设置新的角色权限</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">当前角色</Label>
              <p className="font-medium">{roleUser ? (roleLabels[roleUser.role] || roleUser.role) : ""}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">新角色</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="new-role"><SelectValue placeholder="选择角色" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">用户</SelectItem>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                  {currentUserRole === "SUPER_ADMIN" && <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>取消</Button>
            <Button onClick={handleRoleChange} disabled={!newRole || newRole === roleUser?.role}>确认修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPwdOpen} onOpenChange={setResetPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>为用户 {resetPwdUser?.name} ({resetPwdUser?.email}) 设置新密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码</Label>
            <Input id="new-password" type="password" placeholder="至少6位" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwdOpen(false)}>取消</Button>
            <Button onClick={handleResetPassword} disabled={newPassword.length < 6}>确认重置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除用户 {deleteUser?.name} ({deleteUser?.email}) 吗？此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建用户</DialogTitle>
            <DialogDescription>手动添加一个新用户账号</DialogDescription>
          </DialogHeader>
          <CreateUserForm
            onSuccess={() => {
              setCreateOpen(false);
              fetchUsers(pagination.page);
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateUserForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!email || !password || password.length < 6) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username: username || undefined, name: name || email.split("@")[0], password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("用户创建成功");
        onSuccess();
      } else {
        toast.error(data.error || "创建失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="create-email">邮箱 *</Label>
        <Input id="create-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="create-username">用户名</Label>
        <Input id="create-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="登录用户名（可选）" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="create-name">昵称</Label>
        <Input id="create-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="显示名称" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="create-password">密码 *</Label>
        <Input id="create-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少6位" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button onClick={handleCreate} disabled={loading || !email || password.length < 6}>
          {loading ? "创建中..." : "创建"}
        </Button>
      </DialogFooter>
    </div>
  );
}
