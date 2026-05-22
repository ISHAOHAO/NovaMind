"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Eye,
  Upload,
  ArrowLeft,
  GripVertical,
  FileUp,
  Download,
  Sparkles,
  Bot,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const categories = [
  "前端开发",
  "后端开发",
  "数据库",
  "算法",
  "操作系统",
  "网络",
  "人工智能",
  "软件工程",
  "编程语言",
  "其他",
];

const questionTypes = [
  { value: "single", label: "单选题" },
  { value: "multiple", label: "多选题" },
  { value: "truefalse", label: "判断题" },
  { value: "fillblank", label: "填空题" },
  { value: "cloze", label: "完形填空" },
];

const difficulties = [
  { value: "1", label: "简单" },
  { value: "2", label: "较易" },
  { value: "3", label: "中等" },
  { value: "4", label: "较难" },
  { value: "5", label: "困难" },
];

interface QuestionInput {
  id: string;
  type: string;
  content: string;
  options: { key: string; value: string }[];
  answer: string;
  analysis: string;
  image: string;
  sortOrder: number;
}


const createEmptyQuestion = (): QuestionInput => ({
  id: crypto.randomUUID(),
  type: "single",
  content: "",
  options: [
    { key: "A", value: "" },
    { key: "B", value: "" },
    { key: "C", value: "" },
    { key: "D", value: "" },
  ],
  answer: "",
  analysis: "",
  image: "",
  sortOrder: 0,
});

export default function UploadQuestionsPage() {
  const router = useRouter();

  // Bank info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("1");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Questions
  const [questionList, setQuestionList] = useState<QuestionInput[]>([createEmptyQuestion()]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitError, setSubmitError] = useState(false);

  // Preview
  const [previewQuestion, setPreviewQuestion] = useState<QuestionInput | null>(null);

  // File import mode
  const [uploadMode, setUploadMode] = useState<"manual" | "file">("manual");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileParsing, setFileParsing] = useState(false);
  const [fileMsg, setFileMsg] = useState("");
  const [fileMsgError, setFileMsgError] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<QuestionInput[]>([]);

  // AI review
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiReviewResults, setAiReviewResults] = useState<any[]>([]);
  const [aiReviewMsg, setAiReviewMsg] = useState("");

  // Image upload per question
  const imageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [imageUploading, setImageUploading] = useState<Record<string, boolean>>({});

  const addQuestion = () => {
    const newQ = createEmptyQuestion();
    newQ.sortOrder = questionList.length;
    setQuestionList((prev) => [...prev, newQ]);
  };

  const removeQuestion = (id: string) => {
    setQuestionList((prev) => prev.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, field: keyof QuestionInput, value: unknown) => {
    setQuestionList((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const updateOption = (qId: string, key: string, value: string) => {
    setQuestionList((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          options: q.options.map((o) => (o.key === key ? { ...o, value } : o)),
        };
      })
    );
  };

  const addOption = (qId: string) => {
    setQuestionList((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const nextKey = String.fromCharCode(65 + q.options.length);
        return {
          ...q,
          options: [...q.options, { key: nextKey, value: "" }],
        };
      })
    );
  };

  const removeOption = (qId: string, key: string) => {
    setQuestionList((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          options: q.options.filter((o) => o.key !== key),
        };
      })
    );
  };

  // Cloze blank management
  const addClozeBlank = (qId: string) => {
    setQuestionList((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const nextBlankNum = q.options.length + 1;
        return {
          ...q,
          options: [
            ...q.options,
            { key: String(nextBlankNum), value: "A. |B. |C. |D. " },
          ],
        };
      })
    );
  };

  const removeClozeBlank = (qId: string, blankKey: string) => {
    setQuestionList((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const filtered = q.options.filter((o) => o.key !== blankKey);
        return {
          ...q,
          options: filtered.map((o, i) => ({ ...o, key: String(i + 1) })),
        };
      })
    );
  };

  const updateClozeBlankChoice = (qId: string, blankKey: string, choiceKey: string, choiceValue: string) => {
    setQuestionList((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          options: q.options.map((o) => {
            if (o.key !== blankKey) return o;
            const choices = o.value.split("|").map((c) => {
              const trimmed = c.trim();
              const match = trimmed.match(/^([A-Z])\.\s*(.*)/);
              if (match && match[1] === choiceKey) {
                return `${choiceKey}. ${choiceValue}`;
              }
              return trimmed;
            });
            return { ...o, value: choices.join("|") };
          }),
        };
      })
    );
  };

  const parseClozeChoices = (value: string): { key: string; text: string }[] => {
    return value.split("|").map((c) => {
      const trimmed = c.trim();
      const match = trimmed.match(/^([A-Z])\.\s*(.*)/);
      return { key: match?.[1] || "", text: match?.[2] || trimmed };
    });
  };

  const handleSubmit = async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) { router.replace("/login"); return; }

    if (!title.trim() || !source.trim() || !category) {
      setSubmitMsg("请填写题库的必填字段");
      setSubmitError(true);
      return;
    }

    for (let i = 0; i < questionList.length; i++) {
      const q = questionList[i];
      if (!q.content.trim()) {
        setSubmitMsg(`第 ${i + 1} 题缺少题目内容`);
        setSubmitError(true);
        return;
      }
      if (!q.answer.trim()) {
        setSubmitMsg(`第 ${i + 1} 题缺少答案`);
        setSubmitError(true);
        return;
      }
      if ((q.type === "single" || q.type === "multiple") && q.options.some((o) => !o.value.trim())) {
        setSubmitMsg(`第 ${i + 1} 题存在空的选项`);
        setSubmitError(true);
        return;
      }
      if (q.type === "cloze" && q.options.length === 0) {
        setSubmitMsg(`第 ${i + 1} 题完形填空需要至少设置一个空白`);
        setSubmitError(true);
        return;
      }
    }

    setSubmitting(true);
    setSubmitMsg("");
    setSubmitError(false);

    try {
      // Step 1: Create the bank
      const bankBody = {
        title: title.trim(),
        description: description.trim(),
        source: source.trim(),
        category,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        difficulty: parseInt(difficulty),
        isPublic,
      };

      const bankRes = await fetch("/api/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bankBody),
      });

      const bankData = await bankRes.json();
      if (!bankRes.ok) {
        setSubmitMsg(bankData.error || "创建题库失败");
        setSubmitError(true);
        setSubmitting(false);
        return;
      }

      const newBankId = bankData.data.id;

      // Step 2: Add questions
      const questionsPayload = questionList.map((q, i) => ({
        type: q.type,
        content: q.content.trim(),
        options: q.type === "truefalse" || q.type === "fillblank" ? [] : q.options.map((o) => ({ key: o.key, value: o.value.trim() })),
        answer: q.answer.trim(),
        analysis: q.analysis.trim(),
        image: q.image || undefined,
        sortOrder: i,
      }));

      const qRes = await fetch(`/api/questions/${newBankId}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(questionsPayload),
      });

      const qData = await qRes.json();
      if (!qRes.ok) {
        setSubmitMsg(qData.error || "添加题目失败，但题库已创建");
        setSubmitError(true);
        setSubmitting(false);
        return;
      }

      setSubmitMsg("题库和题目全部上传成功！");
      setSubmitError(false);

      setTimeout(() => {
        router.push(`/questions/${newBankId}`);
      }, 1500);
    } catch {
      setSubmitMsg("网络错误，请稍后重试");
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setFileMsg("请选择文件");
      setFileMsgError(true);
      return;
    }

    setFileParsing(true);
    setFileMsg("");
    setFileMsgError(false);

    try {
      const token = localStorage.getItem("novamind_token");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/questions/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.data?.questions) {
        const questions = data.data.questions.map((q: any, i: number) => ({
          id: crypto.randomUUID(),
          type: q.type || "single",
          content: q.content || "",
          options: q.options && q.options.length > 0 ? q.options : [
            { key: "A", value: "" },
            { key: "B", value: "" },
            { key: "C", value: "" },
            { key: "D", value: "" },
          ],
          answer: q.answer || "",
          analysis: q.analysis || "",
          image: q.image || "",
          sortOrder: i,
        }));
        setParsedQuestions(questions);
        setFileMsg(`成功解析 ${questions.length} 道题目${data.data.errors ? `（${data.data.errors.length} 条警告）` : ""}`);
        setFileMsgError(false);
      } else {
        setFileMsg(data.error || "解析失败");
        setFileMsgError(true);
        if (data.details) {
          setFileMsg((prev) => prev + "\n" + data.details.join("\n"));
        }
      }
    } catch {
      setFileMsg("网络错误，请稍后重试");
      setFileMsgError(true);
    } finally {
      setFileParsing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    const a = document.createElement("a");
    a.href = "/api/questions/template";
    a.download = "novamind-question-template.json";
    a.click();
  };

  const handleAiReview = async () => {
    const questionsToReview = uploadMode === "file" ? parsedQuestions : questionList;
    if (questionsToReview.length === 0) {
      setAiReviewMsg("没有题目可以审查");
      return;
    }

    const token = localStorage.getItem("novamind_token");
    if (!token) return;

    setAiReviewing(true);
    setAiReviewMsg("");
    setAiReviewResults([]);

    try {
      const payload = questionsToReview.map((q) => ({
        type: q.type,
        content: q.content,
        options: q.options.filter((o) => o.value.trim()),
        answer: q.answer,
        analysis: q.analysis,
      }));

      const res = await fetch("/api/ai/review-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questions: payload.slice(0, 20) }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.reviews) {
          setAiReviewResults(data.reviews);
          const issueCount = data.reviews.filter((r: any) => r.hasIssue).length;
          setAiReviewMsg(`审查完成：发现 ${issueCount} 个潜在问题`);
        } else {
          setAiReviewMsg(data.content || "审查完成");
        }
      } else {
        setAiReviewMsg(data.error || "审查失败");
      }
    } catch {
      setAiReviewMsg("网络错误");
    } finally {
      setAiReviewing(false);
    }
  };

  const applyParsedQuestions = () => {
    setQuestionList(parsedQuestions);
    setUploadMode("manual");
    setParsedQuestions([]);
    setFileMsg("");
    setAiReviewResults([]);
    setAiReviewMsg("");
  };

  const handleImageUpload = async (questionId: string) => {
    const input = imageInputRefs.current[questionId];
    const file = input?.files?.[0];
    if (!file) return;

    setImageUploading((prev) => ({ ...prev, [questionId]: true }));
    try {
      const token = localStorage.getItem("novamind_token");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.data?.url) {
        updateQuestion(questionId, "image", data.data.url);
      } else {
        alert(data.error || "图片上传失败");
      }
    } catch {
      alert("图片上传网络错误");
    } finally {
      setImageUploading((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const handleRemoveImage = (questionId: string) => {
    updateQuestion(questionId, "image", "");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/questions")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">上传题库</h1>
          <p className="text-sm text-muted-foreground">创建题库并添加题目</p>
        </div>
      </div>

      {/* Bank info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">题库信息</CardTitle>
          <CardDescription>填写题库的基本信息，带 * 的为必填项</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="btitle">题库名称 *</Label>
              <Input
                id="btitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入题库名称"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bdesc">描述</Label>
              <Textarea
                id="bdesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="题库描述（可选）"
                rows={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bsource">题库来源说明 *</Label>
              <Input
                id="bsource"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="如：原创、教材、考试真题等"
              />
            </div>
            <div className="space-y-2">
              <Label>分类 *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>难度</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {difficulties.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="btags">标签（逗号分隔）</Label>
              <Input
                id="btags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="如：JavaScript, React, 前端"
              />
            </div>
            <div className="flex items-center justify-between sm:col-span-2">
              <div className="space-y-0.5">
                <Label>公开题库</Label>
                <p className="text-xs text-muted-foreground">开启后其他用户也可以查看此题库</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload mode tabs */}
      <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as "manual" | "file")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="manual">手动录入</TabsTrigger>
            <TabsTrigger value="file">文件导入</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="mr-1 h-4 w-4" />
              下载模板
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiReview}
              disabled={aiReviewing}
            >
              {aiReviewing ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Bot className="mr-1 h-4 w-4" />
              )}
              AI审查
            </Button>
          </div>
        </div>

        {aiReviewMsg && (
          <p className="mt-2 text-sm text-muted-foreground">{aiReviewMsg}</p>
        )}

        {aiReviewResults.length > 0 && (
          <div className="mt-2 max-h-[300px] space-y-1 overflow-auto rounded-md border p-3">
            {aiReviewResults.map((review: any, i: number) => (
              <div
                key={i}
                className={`rounded-md border p-2 text-sm ${
                  review.hasIssue
                    ? review.severity === "error"
                      ? "border-red-200 bg-red-50"
                      : "border-yellow-200 bg-yellow-50"
                    : "border-green-200 bg-green-50"
                }`}
              >
                <span className="font-medium">第 {review.index} 题:</span>{" "}
                {review.message}
                {review.suggestion && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    建议: {review.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <TabsContent value="manual" className="mt-4 space-y-0">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">题目列表 ({questionList.length})</h2>
          <Button variant="outline" onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" />
            添加题目
          </Button>
        </div>

        {questionList.map((q, qIndex) => (
          <Card key={q.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary">第 {qIndex + 1} 题</Badge>
                <Select
                  value={q.type}
                  onValueChange={(v) => updateQuestion(q.id, "type", v)}
                >
                  <SelectTrigger className="h-7 w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {questionTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPreviewQuestion(q)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500"
                  onClick={() => removeQuestion(q.id)}
                  disabled={questionList.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>题目内容</Label>
                <Textarea
                  value={q.content}
                  onChange={(e) => updateQuestion(q.id, "content", e.target.value)}
                  placeholder="输入题目内容..."
                  rows={2}
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { imageInputRefs.current[q.id] = el; }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={() => handleImageUpload(q.id)}
                    className="hidden"
                  />
                  {q.image ? (
                    <div className="relative inline-block">
                      <img
                        src={q.image}
                        alt="题目图片预览"
                        className="h-20 rounded-md border object-contain"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground"
                        onClick={() => handleRemoveImage(q.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={imageUploading[q.id]}
                      onClick={() => imageInputRefs.current[q.id]?.click()}
                    >
                      <FileUp className="mr-1 h-3 w-3" />
                      {imageUploading[q.id] ? "上传中..." : "添加图片"}
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    支持 JPG/PNG/WebP，自动压缩
                  </span>
                </div>
              </div>

              {/* Options for single/multiple */}
              {(q.type === "single" || q.type === "multiple") && (
                <div className="space-y-2">
                  <Label>选项</Label>
                  {q.options.map((opt) => (
                    <div key={opt.key} className="flex items-center gap-2">
                      <span className="w-6 text-sm font-medium">{opt.key}.</span>
                      <Input
                        value={opt.value}
                        onChange={(e) => updateOption(q.id, opt.key, e.target.value)}
                        placeholder={`选项 ${opt.key}`}
                        className="flex-1"
                      />
                      {q.options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400"
                          onClick={() => removeOption(q.id, opt.key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(q.id)}
                    disabled={q.options.length >= 10}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    添加选项
                  </Button>
                </div>
              )}

              {/* Blank options for cloze */}
              {q.type === "cloze" && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label>空白处选项设置</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addClozeBlank(q.id)}
                      disabled={q.options.length >= 10}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      添加空白
                    </Button>
                  </div>
                  {q.options.length === 0 && (
                    <p className="text-xs text-muted-foreground">点击"添加空白"来为文章中的每个空设置选项</p>
                  )}
                  {q.options.map((blank, bi) => (
                    <div key={blank.key} className="rounded-md border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">空白 {blank.key}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-400"
                          onClick={() => removeClozeBlank(q.id, blank.key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {parseClozeChoices(blank.value).map((choice) => (
                          <div key={choice.key} className="flex items-center gap-2">
                            <span className="w-5 text-xs font-medium">{choice.key}.</span>
                            <Input
                              value={choice.text}
                              onChange={(e) =>
                                updateClozeBlankChoice(q.id, blank.key, choice.key, e.target.value)
                              }
                              placeholder={`空白 ${blank.key} 的选项 ${choice.key}`}
                              className="h-7 text-xs flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>答案 *</Label>
                  {q.type === "multiple" ? (
                    <Input
                      value={q.answer}
                      onChange={(e) => updateQuestion(q.id, "answer", e.target.value)}
                      placeholder="多个答案用逗号分隔，如 A,C"
                    />
                  ) : q.type === "truefalse" ? (
                    <Select
                      value={q.answer}
                      onValueChange={(v) => updateQuestion(q.id, "answer", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择答案" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">正确</SelectItem>
                        <SelectItem value="false">错误</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : q.type === "cloze" ? (
                    <Input
                      value={q.answer}
                      onChange={(e) => updateQuestion(q.id, "answer", e.target.value)}
                      placeholder={`每个空的答案用逗号分隔，如 ${q.options.map((_, i) => String.fromCharCode(65 + (i % 26))).join(",") || "A,B,C,D"}`}
                    />
                  ) : (
                    <Input
                      value={q.answer}
                      onChange={(e) => updateQuestion(q.id, "answer", e.target.value)}
                      placeholder={
                        q.type === "single" ? "如 A" : "输入正确答案"
                      }
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>解析（可选）</Label>
                  <Textarea
                    value={q.analysis}
                    onChange={(e) => updateQuestion(q.id, "analysis", e.target.value)}
                    placeholder="答案解析..."
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

        </TabsContent>

        <TabsContent value="file" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">文件导入</CardTitle>
              <CardDescription>
                支持 JSON、Word (.docx)、Excel (.xlsx) 格式的题库文件导入。请先下载模板查看格式要求。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border-2 border-dashed p-8 text-center">
                <FileUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  点击下方按钮选择 JSON / Word / Excel 文件或拖放文件到此处
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.docx,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileParsing}
                  >
                    {fileParsing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        解析中...
                      </>
                    ) : (
                      <>
                        <FileUp className="mr-2 h-4 w-4" />
                        选择文件
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleDownloadTemplate}>
                    <Download className="mr-2 h-4 w-4" />
                    下载模板
                  </Button>
                </div>
              </div>

              {fileMsg && (
                <p className={`whitespace-pre-wrap text-sm ${fileMsgError ? "text-red-600" : "text-green-600"}`}>
                  {fileMsg}
                </p>
              )}

              {/* Parsed questions preview */}
              {parsedQuestions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      已解析 {parsedQuestions.length} 道题目
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setParsedQuestions([]);
                          setFileMsg("");
                          setAiReviewResults([]);
                          setAiReviewMsg("");
                        }}
                      >
                        清除
                      </Button>
                      <Button size="sm" onClick={applyParsedQuestions}>
                        导入到编辑器
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[400px] space-y-2 overflow-auto rounded-md border p-3">
                    {parsedQuestions.map((q, i) => (
                      <div key={q.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {questionTypes.find((t) => t.value === q.type)?.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">第 {i + 1} 题</span>
                        </div>
                        <p className="font-medium">{q.content}</p>
                        {q.options && q.options.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {q.options.filter((o) => o.value).map((opt) => (
                              <span
                                key={opt.key}
                                className={`rounded border px-2 py-0.5 text-xs ${
                                  opt.key === q.answer
                                    ? "border-green-300 bg-green-50 text-green-700"
                                    : "bg-muted/30"
                                }`}
                              >
                                {opt.key}. {opt.value}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          答案: {q.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit */}
      <div className="flex flex-col items-center gap-3 border-t pt-6">
        {submitMsg && (
          <p className={`text-sm ${submitError ? "text-red-600" : "text-green-600"}`}>
            {submitMsg}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/questions")}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} size="lg">
            <Upload className="mr-2 h-4 w-4" />
            {submitting ? "上传中..." : "提交全部"}
          </Button>
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog
        open={!!previewQuestion}
        onOpenChange={(open) => {
          if (!open) setPreviewQuestion(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>题目预览</DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-4">
              <Badge variant="outline">
                {questionTypes.find((t) => t.value === previewQuestion.type)?.label}
              </Badge>
              <p className="whitespace-pre-wrap">{previewQuestion.content}</p>
              {(previewQuestion.type === "single" || previewQuestion.type === "multiple") &&
                previewQuestion.options.length > 0 && (
                  <div className="space-y-2">
                    {previewQuestion.options.map((opt) => (
                      <div
                        key={opt.key}
                        className="flex items-center gap-2 rounded-md border p-2"
                      >
                        <span className="font-medium">{opt.key}.</span>
                        <span>{opt.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              {previewQuestion.type === "cloze" && previewQuestion.options.length > 0 && (
                <div className="space-y-3 rounded-md border p-3">
                  <span className="text-sm font-medium">空白处选项：</span>
                  {previewQuestion.options.map((blank) => {
                    const choices = parseClozeChoices(blank.value);
                    return (
                      <div key={blank.key} className="rounded border p-2">
                        <p className="mb-1 text-xs font-medium">空白 {blank.key}</p>
                        <div className="grid grid-cols-2 gap-1">
                          {choices.map((ch) => (
                            <span key={ch.key} className="text-xs">
                              <strong>{ch.key}.</strong> {ch.text || "(空)"}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div>
                <span className="text-sm font-medium">答案：</span>
                <span className="text-sm">{previewQuestion.answer}</span>
              </div>
              {previewQuestion.analysis && (
                <div>
                  <span className="text-sm font-medium">解析：</span>
                  <p className="text-sm text-muted-foreground">
                    {previewQuestion.analysis}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
