"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ReviewTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const categories = [
  "人工智能",
  "前端开发",
  "后端开发",
  "数据库",
  "操作系统",
  "计算机网络",
  "数据结构",
  "算法",
  "编程语言",
  "综合",
];

export default function ReviewTemplatesPage() {
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReviewTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("综合");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteTemplate, setDeleteTemplate] = useState<ReviewTemplate | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/admin/review-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast.error("加载模板失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormContent("");
    setFormCategory("综合");
    setFormIsDefault(false);
    setFormOpen(true);
  };

  const openEditDialog = (template: ReviewTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormContent(template.content);
    setFormCategory(template.category || "综合");
    setFormIsDefault(template.isDefault);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formContent.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("novamind_token");
      if (editingTemplate) {
        const res = await fetch(`/api/admin/review-templates?id=${editingTemplate.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formName,
            content: formContent,
            category: formCategory,
            isDefault: formIsDefault,
          }),
        });
        if (res.ok) {
          setFormOpen(false);
          fetchTemplates();
          toast.success("更新成功");
        } else {
          const data = await res.json();
          toast.error(data.error || "更新失败");
        }
      } else {
        const res = await fetch("/api/admin/review-templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formName,
            content: formContent,
            category: formCategory,
            isDefault: formIsDefault,
          }),
        });
        if (res.ok) {
          setFormOpen(false);
          fetchTemplates();
          toast.success("创建成功");
        } else {
          const data = await res.json();
          toast.error(data.error || "创建失败");
        }
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch(`/api/admin/review-templates?id=${deleteTemplate.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDeleteOpen(false);
        setDeleteTemplate(null);
        fetchTemplates();
        toast.success("删除成功");
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">审核模板</h1>
          <p className="text-sm text-muted-foreground">管理题库审核模板</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-1 h-4 w-4" />
          新建模板
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">模板列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">暂无模板</p>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <Card key={template.id} className="border-muted">
                  <CardContent className="flex items-start justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{template.name}</h3>
                        <Badge variant="outline">{template.category}</Badge>
                        {template.isDefault && (
                          <Badge variant="success">默认</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteTemplate(template);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "编辑模板" : "新建模板"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate ? "修改审核模板内容" : "创建新的审核模板"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="模板名称"
              />
            </div>
            <div className="space-y-2">
              <Label>分类</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="模板内容..."
                rows={6}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formIsDefault}
                onCheckedChange={(checked) => setFormIsDefault(!!checked)}
              />
              <Label className="text-sm">设为默认模板</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除模板</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模板 <strong>{deleteTemplate?.name}</strong> 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
