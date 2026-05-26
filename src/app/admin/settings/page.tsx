"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Save,
  RefreshCw,
  Settings2,
  Mail,
  Bot,
  Shield,
  Eye,
  EyeOff,
  Wrench,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  CUSTOM_PROVIDER_VALUE,
  CUSTOM_MODEL_VALUE,
  getProviderByValue,
  getProviderOptions,
} from "@/lib/ai-providers";

interface Config {
  id: string;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

interface ConfigGroup {
  title: string;
  icon: React.ElementType;
  items: ConfigItem[];
}

interface ConfigItem {
  key: string;
  label: string;
  description: string;
  type: "text" | "number" | "switch" | "password" | "select" | "model_select" | "base_url";
  options?: { label: string; value: string }[];
}

const configGroups: ConfigGroup[] = [
  {
    title: "基本设置",
    icon: Settings2,
    items: [
      { key: "site_name", label: "站点名称", description: "网站顶部和标题显示的名称", type: "text" },
      { key: "site_description", label: "站点描述", description: "SEO 和网站简介描述", type: "text" },
      { key: "register_enabled", label: "开放注册", description: "是否允许新用户注册", type: "switch" },
      { key: "email_verification_required", label: "注册邮箱验证", description: "注册时是否需要邮箱验证后才能登录", type: "switch" },
    ],
  },
  {
    title: "体验版设置",
    icon: Eye,
    items: [
      { key: "trial_enabled", label: "启用体验版", description: "是否允许未激活用户使用体验模式", type: "switch" },
      { key: "trial_daily_minutes", label: "每日试用时长", description: "体验用户每天可使用时长（分钟）", type: "number" },
      { key: "activation_required", label: "强制激活", description: "是否强制要求用户激活后才能使用", type: "switch" },
    ],
  },
  {
    title: "邮件设置",
    icon: Mail,
    items: [
      { key: "smtp_host", label: "SMTP 服务器", description: "邮件发送服务器地址", type: "text" },
      { key: "smtp_port", label: "SMTP 端口", description: "邮件服务器端口号", type: "number" },
      { key: "smtp_user", label: "SMTP 用户名", description: "邮件服务器登录用户名", type: "text" },
      { key: "smtp_pass", label: "SMTP 密码", description: "邮件服务器登录密码", type: "password" },
      { key: "smtp_from", label: "发件人地址", description: "系统邮件发件人邮箱地址", type: "text" },
    ],
  },
  {
    title: "AI 设置",
    icon: Bot,
    items: [
      { key: "ai_enabled", label: "AI 功能", description: "是否启用 AI 相关功能", type: "switch" },
    {
      key: "ai_provider",
      label: "AI 提供商",
      description: "AI 服务提供商",
      type: "select",
      options: getProviderOptions(),
    },
    { key: "ai_model", label: "AI 模型", description: "使用的 AI 模型名称", type: "model_select" },
    { key: "ai_api_key", label: "API 密钥", description: "AI 服务 API 密钥", type: "password" },
    { key: "ai_base_url", label: "API 地址", description: "AI 服务基础 URL", type: "base_url" },
    { key: "ai_trial_daily_limit", label: "体验版每日AI次数", description: "未激活用户每天可使用 AI 的次数（0=不限制）", type: "number" },
    { key: "ai_analysis_daily_limit", label: "学习分析每日限额", description: "体验版用户每日学习分析（AI薄弱点识别）次数限制", type: "number" },
    { key: "ai_note_summary_daily_limit", label: "笔记总结每日限额", description: "体验版用户每日AI笔记总结次数限制", type: "number" },
  ],
  },
  {
    title: "风控设置",
    icon: Shield,
    items: [
      { key: "register_ip_limit", label: "IP 注册限制", description: "同一 IP 每天允许注册次数", type: "number" },
      { key: "register_device_limit", label: "设备注册限制", description: "同一设备允许注册账号数", type: "number" },
      { key: "global_rate_limit", label: "全局请求限制", description: "每分钟每 IP 最大请求数", type: "number" },
      { key: "anti_sharing_enabled", label: "防账号共享", description: "启用防账号共享检测", type: "switch" },
      { key: "abnormal_behavior_threshold", label: "异常检测阈值", description: "触发异常检测的敏感度 (1-100)", type: "number" },
      { key: "max_session_devices", label: "最大会话设备", description: "允许同时登录的最大设备数", type: "number" },
    ],
  },
  {
    title: "审核设置",
    icon: Eye,
    items: [
      { key: "question_review_required", label: "题库审核", description: "用户上传题库是否需要审核", type: "switch" },
    ],
  },
];

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testEmailMsg, setTestEmailMsg] = useState("");
  const [testEmailOk, setTestEmailOk] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfigs();
  }, []);

  const currentProvider = getProviderByValue(configs["ai_provider"] || "");

  const providerModelOptions = currentProvider && currentProvider.value !== CUSTOM_PROVIDER_VALUE
    ? [...currentProvider.models, { label: "✏️ 自定义模型", value: CUSTOM_MODEL_VALUE }]
    : [];

  const isCurrentModelCustom =
    isCustomModel ||
    (!!currentProvider &&
      currentProvider.value !== CUSTOM_PROVIDER_VALUE &&
      !!configs["ai_model"] &&
      !currentProvider.models.some((m) => m.value === configs["ai_model"]));

  const handleProviderChange = useCallback(
    (value: string) => {
      const provider = getProviderByValue(value);
      setConfigValue("ai_provider", value);
      if (provider && provider.value !== CUSTOM_PROVIDER_VALUE) {
        setConfigValue("ai_base_url", provider.baseUrl);
        if (provider.models.length > 0) {
          setConfigValue("ai_model", provider.models[0].value);
          setIsCustomModel(false);
        }
      }
    },
    []
  );

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const map: Record<string, string> = {};
      if (data.configs) {
        for (const c of data.configs) {
          map[c.key] = c.value;
        }
      }
      setConfigs(map);
    } catch {
      toast.error("获取配置失败");
    } finally {
      setLoading(false);
    }
  };

  const getConfigValue = (key: string, defaultValue = ""): string => {
    return configs[key] ?? defaultValue;
  };

  const setConfigValue = (key: string, value: string) => {
    setConfigs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveGroup = async (group: ConfigGroup) => {
    const itemsToSave = group.items
      .map((item) => ({
        key: item.key,
        value: configs[item.key] ?? "",
      }))
      .filter((item) => item.value !== undefined);

    if (itemsToSave.length === 0) return;

    setSavingGroup(group.title);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(itemsToSave),
      });
      if (res.ok) {
        await loadConfigs();
        toast.success(`已保存 ${itemsToSave.length} 项配置`);
      } else {
        const data = await res.json();
        if (data.failed > 0 && data.errors) {
          toast.error(`保存失败：${data.errors.join("；")}`);
        } else {
          toast.error(data.error || "保存失败");
        }
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSavingGroup(null);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const allItems: { key: string; value: string }[] = [];
    for (const group of configGroups) {
      for (const item of group.items) {
        allItems.push({ key: item.key, value: configs[item.key] ?? "" });
      }
    }
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(allItems),
      });
      if (res.ok) {
        await loadConfigs();
        toast.success(`已保存 ${allItems.length} 项配置`);
      } else {
        const data = await res.json();
        if (data.failed > 0 && data.errors) {
          toast.error(`保存失败：${data.errors.join("；")}`);
        } else {
          toast.error(data.error || "保存失败");
        }
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleSmtpTest = async () => {
    if (!testEmail.trim()) {
      setTestEmailMsg("请输入测试邮箱");
      setTestEmailOk(false);
      return;
    }
    setSmtpTesting(true);
    setTestEmailMsg("");
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/admin/smtp-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestEmailMsg(data.message || "发送成功");
        setTestEmailOk(true);
      } else {
        setTestEmailMsg(data.error || "发送失败");
        setTestEmailOk(false);
      }
    } catch {
      setTestEmailMsg("网络错误");
      setTestEmailOk(false);
    } finally {
      setSmtpTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统设置</h1>
          <p className="text-sm text-muted-foreground">配置系统各项参数</p>
        </div>
        <Button onClick={handleSaveAll} disabled={saving || loading}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-1 h-4 w-4" />
              保存全部
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          {configGroups.map((group) => {
            const Icon = group.icon;
            const isSaving = savingGroup === group.title;
            return (
              <Card key={group.title}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{group.title}</CardTitle>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveGroup(group)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-3 w-3" />
                      )}
                      保存
                    </Button>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={item.key} className="text-sm font-medium">
                            {item.label}
                          </Label>
                          {item.type === "switch" && (
                            <Switch
                              id={item.key}
                              checked={getConfigValue(item.key) === "true"}
                              onCheckedChange={(checked) =>
                                setConfigValue(item.key, String(checked))
                              }
                            />
                          )}
                        </div>
                        {item.type === "select" ? (
                          <Select
                            value={getConfigValue(item.key)}
                            onValueChange={
                              item.key === "ai_provider"
                                ? handleProviderChange
                                : (v) => setConfigValue(item.key, v)
                            }
                          >
                            <SelectTrigger id={item.key}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {item.options?.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : item.type === "model_select" ? (
                          currentProvider &&
                          currentProvider.value !== CUSTOM_PROVIDER_VALUE ? (
                            <div className="space-y-2">
                              <Select
                                value={
                                  isCurrentModelCustom
                                    ? CUSTOM_MODEL_VALUE
                                    : getConfigValue(item.key)
                                }
                                onValueChange={(v) => {
                                  if (v === CUSTOM_MODEL_VALUE) {
                                    setIsCustomModel(true);
                                    setConfigValue(item.key, "");
                                  } else {
                                    setIsCustomModel(false);
                                    setConfigValue(item.key, v);
                                  }
                                }}
                              >
                                <SelectTrigger id={item.key}>
                                  <SelectValue placeholder="选择模型..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {providerModelOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isCurrentModelCustom && (
                                <Input
                                  id={item.key}
                                  type="text"
                                  value={getConfigValue(item.key)}
                                  onChange={(e) =>
                                    setConfigValue(item.key, e.target.value)
                                  }
                                  placeholder="输入自定义模型名称..."
                                />
                              )}
                            </div>
                          ) : (
                            <Input
                              id={item.key}
                              type="text"
                              value={getConfigValue(item.key)}
                              onChange={(e) => setConfigValue(item.key, e.target.value)}
                              placeholder={item.description}
                            />
                          )
                        ) : item.type === "base_url" ? (
                          <Input
                            id={item.key}
                            type="text"
                            value={getConfigValue(item.key)}
                            onChange={(e) => setConfigValue(item.key, e.target.value)}
                            placeholder={item.description}
                            disabled={
                              !!currentProvider &&
                              currentProvider.value !== CUSTOM_PROVIDER_VALUE
                            }
                          />
                        ) : item.type === "switch" ? null : item.type === "password" ? (
                          <div className="relative">
                            <Input
                              id={item.key}
                              type={showPasswords[item.key] ? "text" : "password"}
                              value={getConfigValue(item.key)}
                              onChange={(e) => setConfigValue(item.key, e.target.value)}
                              placeholder={item.description}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-10 w-10"
                              onClick={() =>
                                setShowPasswords((prev) => ({
                                  ...prev,
                                  [item.key]: !prev[item.key],
                                }))
                              }
                            >
                              {showPasswords[item.key] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Input
                            id={item.key}
                            type={item.type === "number" ? "number" : "text"}
                            value={getConfigValue(item.key)}
                            onChange={(e) => setConfigValue(item.key, e.target.value)}
                            placeholder={item.description}
                          />
                        )}
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                  {group.title === "邮件设置" && (
                    <div className="mt-4 space-y-3 rounded-lg border p-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">SMTP 连接测试</span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          value={testEmail}
                          onChange={(e) => { setTestEmail(e.target.value); setTestEmailMsg(""); }}
                          placeholder="输入测试接收邮箱..."
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSmtpTest}
                          disabled={smtpTesting}
                        >
                          {smtpTesting && <RefreshCw className="mr-1 h-3 w-3 animate-spin" />}
                          测试发送
                        </Button>
                      </div>
                      {testEmailMsg && (
                        <p className={`text-xs ${testEmailOk ? "text-green-600" : "text-red-600"}`}>
                          {testEmailMsg}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
