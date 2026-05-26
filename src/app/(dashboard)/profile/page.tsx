"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Shield, Clock, Key, Unlock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  isActivated: boolean;
  activatedAt?: string;
  todayUsedSeconds?: number;
}

const roleLabels: Record<string, string> = {
  USER: "普通用户",
  ADMIN: "管理员",
  SUPER_ADMIN: "超级管理员",
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit profile
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Change password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Activation
  const [activationCode, setActivationCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState("");
  const [activateError, setActivateError] = useState(false);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const u = data.user;
        setUser(u);
        setEditName(u.name || "");
        localStorage.setItem("novamind_user", JSON.stringify(u));
      } else if (res.status === 401) {
        localStorage.removeItem("novamind_token");
        localStorage.removeItem("novamind_user");
        router.replace("/login");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSaveProfile = async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token || !editName.trim()) return;
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfileMsg("个人资料已更新");
        setEditing(false);
        setUser((prev) => (prev ? { ...prev, name: editName.trim() } : prev));
        const stored = localStorage.getItem("novamind_user");
        if (stored) {
          const u = JSON.parse(stored);
          u.name = editName.trim();
          localStorage.setItem("novamind_user", JSON.stringify(u));
        }
      } else {
        setProfileMsg(data.error || "更新失败");
      }
    } catch {
      setProfileMsg("网络错误，请稍后重试");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMsg("请填写所有密码字段");
      setPasswordError(true);
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg("新密码至少 6 位");
      setPasswordError(true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("两次密码输入不一致");
      setPasswordError(true);
      return;
    }
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    setChangingPassword(true);
    setPasswordMsg("");
    setPasswordError(false);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg("密码修改成功");
        setPasswordError(false);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMsg(data.error || "密码修改失败");
        setPasswordError(true);
      }
    } catch {
      setPasswordMsg("网络错误，请稍后重试");
      setPasswordError(true);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleActivate = async () => {
    if (!activationCode.trim()) {
      setActivateMsg("请输入激活码");
      setActivateError(true);
      return;
    }
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    setActivating(true);
    setActivateMsg("");
    setActivateError(false);
    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: activationCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setActivateMsg("账号激活成功！");
        setActivateError(false);
        setActivationCode("");
        fetchUser();
      } else {
        setActivateMsg(data.error || "激活失败");
        setActivateError(true);
      }
    } catch {
      setActivateMsg("网络错误，请稍后重试");
      setActivateError(true);
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  const initials = user?.name?.charAt(0)?.toUpperCase() || "U";
  const todayUsedSeconds = user?.todayUsedSeconds ?? 0;
  const usedMinutes = Math.floor(todayUsedSeconds / 60);
  const usedSeconds = todayUsedSeconds % 60;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">个人中心</h1>

      {/* User info card */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="输入昵称"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                    {savingProfile ? "保存中..." : "保存"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditName(user?.name || ""); }}>
                    取消
                  </Button>
                </div>
                {profileMsg && (
                  <p className="text-xs text-muted-foreground">{profileMsg}</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{user?.name}</h2>
                  <Badge variant={user?.isActivated ? "default" : "secondary"}>
                    {user?.isActivated ? "已激活" : "未激活"}
                  </Badge>
                  <Badge variant="outline">
                    {roleLabels[user?.role || "USER"] || user?.role}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {user?.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    {roleLabels[user?.role || "USER"]}
                  </span>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0"
                  onClick={() => setEditing(true)}
                >
                  编辑资料
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="password">
        <TabsList className="w-full">
          <TabsTrigger value="password" className="flex-1">
            <Key className="mr-2 h-4 w-4" />
            修改密码
          </TabsTrigger>
          <TabsTrigger value="activate" className="flex-1" disabled={user?.isActivated}>
            <Unlock className="mr-2 h-4 w-4" />
            激活账号
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex-1">
            <Clock className="mr-2 h-4 w-4" />
            使用统计
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">修改密码</CardTitle>
              <CardDescription>输入旧密码并设置新密码</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">旧密码</Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入旧密码"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 位"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                />
              </div>
              {passwordMsg && (
                <p className={`text-sm ${passwordError ? "text-red-600" : "text-green-600"}`}>
                  {passwordMsg}
                </p>
              )}
              <Button onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? "修改中..." : "修改密码"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activate">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">激活账号</CardTitle>
              <CardDescription>
                {user?.isActivated
                  ? "您的账号已激活，无需再次激活"
                  : "输入激活码激活您的账号，解锁全部功能"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.isActivated ? (
                <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
                  <Shield className="h-4 w-4" />
                  账号已激活
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="activationCode">激活码</Label>
                    <Input
                      id="activationCode"
                      value={activationCode}
                      onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                      placeholder="输入激活码"
                    />
                  </div>
                  {activateMsg && (
                    <p className={`text-sm ${activateError ? "text-red-600" : "text-green-600"}`}>
                      {activateMsg}
                    </p>
                  )}
                  <Button onClick={handleActivate} disabled={activating}>
                    {activating ? "激活中..." : "激活"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">使用统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md bg-muted/50 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">今日使用时长</p>
                  <p className="text-2xl font-bold truncate">
                    {usedMinutes > 0 || usedSeconds > 0
                      ? `${usedMinutes} 分 ${usedSeconds} 秒`
                      : "0 分钟"}
                  </p>
                </div>
                <Clock className="ml-3 h-8 w-8 shrink-0 text-muted-foreground" />
              </div>
              <Separator />
              {user?.isActivated ? (
                <div className="flex items-center justify-between rounded-md bg-primary/5 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">使用权限</p>
                    <p className="text-2xl font-bold text-primary truncate">无限使用</p>
                  </div>
                  <Shield className="ml-3 h-8 w-8 shrink-0 text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-md bg-muted/50 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium whitespace-nowrap">试用状态</p>
                      <p className="text-2xl font-bold truncate text-orange-600">
                        试用中
                      </p>
                    </div>
                    <Clock className="ml-3 h-8 w-8 shrink-0 text-muted-foreground" />
                  </div>
                  <Separator />
                  <div className="rounded-md bg-muted/30 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      激活账号后即可无限使用全部功能
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
