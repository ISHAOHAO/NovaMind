"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  List,
  X,
  BarChart3,
  Trophy,
  Medal,
  Timer,
  CheckCheck,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { useExamStore } from "@/stores/exam-store";
import toast from "react-hot-toast";

interface RankingItem {
  rank: number;
  userId: string;
  userName: string;
  userAvatar: string | null;
  score: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: string | null;
  duration: number | null;
}

/** 创建考试时写入 settings 的参数（见 POST /api/exams），用于"再考一次" */
interface ExamSettings {
  bankIds?: unknown;
  originalCount?: unknown;
}

export default function ExamTakingPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  const {
    exam,
    currentIndex,
    answers,
    timeRemaining,
    setExam,
    setCurrentIndex,
    setAnswer,
    startTimer,
    stopTimer,
    resetExam,
  } = useExamStore();

  const [loading, setLoading] = useState(true);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<RankingItem | null>(null);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [retaking, setRetaking] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("novamind_token") : null;

  const fetchExam = useCallback(async () => {
    if (!token) { router.replace("/login"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setExam(data);

        const existingAnswers: Record<string, string> = {};
        data.questions?.forEach((eq: any) => {
          if (eq.userAnswer) existingAnswers[eq.questionId] = eq.userAnswer;
        });

        if (data.status === "COMPLETED") {
          setShowResults(true);
          fetchRankings();
        } else if (data.status === "IN_PROGRESS") {
          const elapsed = data.startedAt
            ? Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000)
            : 0;
          const remaining = Math.max(0, data.durationMinutes * 60 - elapsed);
          useExamStore.setState({ timeRemaining: remaining });
          startTimer(remaining / 60);
          // Preserve answers from backend
          useExamStore.setState({ answers: existingAnswers });
        }
      } else if (res.status === 401) {
        router.replace("/login");
      } else {
        toast.error("考试不存在");
      }
    } catch {
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [examId, token, router, setExam, startTimer]);

  useEffect(() => {
    fetchExam();
    return () => {
      stopTimer();
    };
  }, [fetchExam, stopTimer]);

  useEffect(() => {
    if (exam && exam.status === "IN_PROGRESS" && timeRemaining !== null && timeRemaining <= 0) {
      handleComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining]);

  const fetchRankings = async () => {
    setRankingsLoading(true);
    try {
      const res = await fetch(`/api/exams/ranking?examId=${examId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRankings(data.rankings || []);
        setCurrentUserRank(data.currentUserRank || null);
      }
    } catch {
      // ignore
    } finally {
      setRankingsLoading(false);
    }
  };

  const handleStartExam = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "start" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (exam) {
          const updated = { ...exam, status: "IN_PROGRESS", startedAt: data.startedAt };
          setExam(updated);
          startTimer(exam.durationMinutes);
        }
        toast.success("考试开始!");
      }
    } catch {
      toast.error("开始失败");
    }
  };

  const handleSubmitAnswer = async (eqId: string, questionId: string, answer: string, isCorrect: boolean) => {
    if (!token || !exam) return;
    setAnswer(questionId, answer);

    setSubmittingAnswer(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "answer",
          questionId,
          userAnswer: answer,
          isCorrect,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
      }
    } catch {
      // silent fail for auto-save
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleComplete = async () => {
    if (!token || !exam || completing) return;
    setCompleting(true);
    setShowConfirmSubmit(false);
    stopTimer();

    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "complete" }),
      });
      if (res.ok) {
        const data = await res.json();
        const completedExam = {
          ...exam,
          ...data,
          status: "COMPLETED",
        };
        setExam(completedExam);
        setShowResults(true);
        toast.success("交卷成功!");
        fetchRankings();
      } else {
        toast.error("交卷失败");
      }
    } catch {
      toast.error("交卷失败");
    } finally {
      setCompleting(false);
    }
  };

  const handleAbandonExam = async () => {
    if (!token || !exam) return;
    setAbandoning(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "abandon" }),
      });
      if (res.ok) {
        stopTimer();
        toast.success("考试已放弃");
        router.push("/exams");
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setAbandoning(false);
    }
  };

  const canRetake = (() => {
    if (!exam) return false;
    const settings = exam.settings as ExamSettings | null;
    return Boolean(
      settings &&
      Array.isArray(settings.bankIds) &&
      settings.bankIds.length > 0 &&
      typeof settings.originalCount === "number" &&
      settings.originalCount > 0
    );
  })();

  const handleRetake = async () => {
    if (!token || !exam) return;
    const settings = exam.settings as ExamSettings | null;
    if (
      !settings ||
      !Array.isArray(settings.bankIds) ||
      settings.bankIds.length === 0 ||
      typeof settings.originalCount !== "number" ||
      settings.originalCount <= 0
    ) {
      return;
    }

    setRetaking(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: exam.title,
          description: exam.description || undefined,
          bankIds: settings.bankIds,
          questionCount: settings.originalCount,
          durationMinutes: exam.durationMinutes,
          difficulty: exam.difficulty,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("新考试已创建");
        router.push(`/exams/${data.exam.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "创建失败");
      }
    } catch {
      toast.error("创建失败");
    } finally {
      setRetaking(false);
    }
  };

  const getAnswerForQuestion = (questionId: string) => {
    return answers[questionId] || "";
  };

  const checkCorrectness = (questionId: string) => {
    if (!exam) return null;
    const eq = exam.questions.find((q) => q.questionId === questionId);
    if (exam.status === "COMPLETED") return eq?.isCorrect ?? null;
    return eq?.isCorrect ?? null;
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).length;
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-medium text-muted-foreground">{rank}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Card>
          <CardContent className="p-8">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-20 w-full mt-4" />
            <Skeleton className="h-10 w-32 mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">考试不存在或无权访问</p>
        <Button className="mt-4" onClick={() => router.push("/exams")}>
          返回列表
        </Button>
      </div>
    );
  }

  // DRAFT status - show preview with start button
  if (exam.status === "DRAFT") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.push("/exams")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{exam.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {exam.description && (
              <p className="text-muted-foreground">{exam.description}</p>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>时长: {exam.durationMinutes} 分钟</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span>难度: {exam.difficultyLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCheck className="h-4 w-4 text-muted-foreground" />
                <span>题目: {exam.totalQuestions} 题</span>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-medium">题目预览</h3>
              {exam.questions.slice(0, 3).map((eq, idx) => (
                <div key={eq.id} className="p-3 border rounded-lg">
                  <p className="text-sm font-medium">第 {idx + 1} 题 · {eq.question.type}</p>
                  <p className="text-sm mt-1">{eq.question.content}</p>
                  {eq.question.options && Array.isArray(eq.question.options) && (
                    <div className="mt-2 space-y-1">
                      {eq.question.options.map((opt: any) => (
                        <div key={opt.key} className="text-sm text-muted-foreground">
                          {opt.key}. {opt.value}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {exam.totalQuestions > 3 && (
                <p className="text-sm text-muted-foreground text-center">
                  ... 还有 {exam.totalQuestions - 3} 题
                </p>
              )}
            </div>
            <Button className="w-full" size="lg" onClick={handleStartExam}>
              <Play className="mr-2 h-5 w-5" />
              开始考试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // IN_PROGRESS status - exam taking mode
  if (exam.status === "IN_PROGRESS") {
    const currentEq = exam.questions[currentIndex];
    if (!currentEq) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">题目数据异常</p>
        </div>
      );
    }

    const currentQuestion = currentEq.question;
    const currentAnswer = getAnswerForQuestion(currentQuestion.id);
    const currentResult = checkCorrectness(currentQuestion.id);
    const answeredCount = getAnsweredCount();
    const progress = exam.totalQuestions > 0 ? (answeredCount / exam.totalQuestions) * 100 : 0;

    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Timer & Progress Bar */}
        <div className="space-y-2 mb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setShowExitConfirm(true)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                退出
              </Button>
              <span className="text-sm font-medium">{exam.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {answeredCount}/{exam.totalQuestions} 已答
              </span>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-sm",
                  timeRemaining !== null && timeRemaining <= 300
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                )}
              >
                <Clock className="h-4 w-4" />
                {formatTime(timeRemaining)}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <List className="h-4 w-4 mr-1" />
                题目列表
              </Button>
            </div>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Main content area */}
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Question area */}
          <div className="flex-1 overflow-y-auto">
            <Card className="h-full">
              <CardContent className="p-6 space-y-6">
                {/* Question number and type */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {currentQuestion.type === "single"
                      ? "单选题"
                      : currentQuestion.type === "multiple"
                      ? "多选题"
                      : currentQuestion.type === "fillblank"
                      ? "填空题"
                      : currentQuestion.type === "truefalse"
                      ? "判断题"
                      : currentQuestion.type === "cloze"
                      ? "完形填空"
                      : "题"}
                  </Badge>
                  <span className="text-sm font-medium text-muted-foreground">
                    第 {currentIndex + 1} / {exam.totalQuestions} 题
                  </span>
                </div>

                {/* Question content（cloze 题干含空格标记，改在下方与选择控件一起渲染） */}
                {currentQuestion.type !== "cloze" && (
                  <div className="text-base font-medium leading-relaxed">
                    {currentQuestion.content}
                  </div>
                )}

                {currentQuestion.image && (
                  <img
                    src={currentQuestion.image}
                    alt="题目图片"
                    className="max-w-full rounded-lg"
                  />
                )}

                {/* Options based on type */}
                {(currentQuestion.type === "single" || currentQuestion.type === "truefalse") && (
                  <RadioGroup
                    value={currentAnswer}
                    onValueChange={(value) => {
                      const isCorrect = value === currentQuestion.answer;
                      handleSubmitAnswer(currentEq.id, currentQuestion.id, value, isCorrect);
                    }}
                    className="space-y-3"
                  >
                    {(Array.isArray(currentQuestion.options)
                      ? currentQuestion.options
                      : currentQuestion.type === "truefalse"
                      ? [{ key: "T", value: "正确" }, { key: "F", value: "错误" }]
                      : []
                    ).map((option: any) => (
                      <Label
                        key={option.key}
                        htmlFor={`option-${option.key}`}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                          currentAnswer === option.key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent"
                        )}
                      >
                        <RadioGroupItem value={option.key} id={`option-${option.key}`} />
                        <span className="font-medium text-muted-foreground mr-2">
                          {option.key}.
                        </span>
                        <span className="flex-1">{option.value}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                )}

                {currentQuestion.type === "multiple" && (
                  <div className="space-y-3">
                    {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map(
                      (option: any) => {
                        const selected = currentAnswer.split(",").filter(Boolean);
                        const isSelected = selected.includes(option.key);
                        return (
                          <Label
                            key={option.key}
                            htmlFor={`cb-${option.key}`}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-accent"
                            )}
                          >
                            <Checkbox
                              id={`cb-${option.key}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selected);
                                if (checked) newSelected.add(option.key);
                                else newSelected.delete(option.key);
                                const newAnswer = Array.from(newSelected).sort().join(",");
                                const sortedCorrect = (currentQuestion.answer || "")
                                  .split(",")
                                  .sort()
                                  .join(",");
                                const isCorrect = newAnswer === sortedCorrect;
                                handleSubmitAnswer(
                                  currentEq.id,
                                  currentQuestion.id,
                                  newAnswer,
                                  isCorrect
                                );
                              }}
                            />
                            <span className="font-medium text-muted-foreground mr-2">
                              {option.key}.
                            </span>
                            <span className="flex-1">{option.value}</span>
                          </Label>
                        );
                      }
                    )}
                  </div>
                )}

                {currentQuestion.type === "fillblank" && (
                  <div className="space-y-3">
                    <Input
                      placeholder="请输入答案"
                      value={currentAnswer}
                      onChange={(e) => {
                        setAnswer(currentQuestion.id, e.target.value);
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) {
                          const isCorrect =
                            val.toLowerCase() === (currentQuestion.answer || "").toLowerCase();
                          handleSubmitAnswer(currentEq.id, currentQuestion.id, val, isCorrect);
                        }
                      }}
                    />
                  </div>
                )}

                {currentQuestion.type === "cloze" && (
                  <div className="text-base leading-relaxed">
                    {(() => {
                      const blanks = (Array.isArray(currentQuestion.options)
                        ? currentQuestion.options
                        : []
                      )
                        .slice()
                        .sort((a, b) => parseInt(a.key, 10) - parseInt(b.key, 10));
                      const blankKeys = blanks.map((b) => b.key);
                      const parts = currentQuestion.content.split(/_{2,}\(?(\d+)\)?_{2,}/g);
                      const selectedParts = currentAnswer.split(",");
                      return parts.map((part, i) => {
                        if (i % 2 === 0) return <span key={i}>{part}</span>;
                        const blankNum = part;
                        const blankIndex = blankKeys.indexOf(blankNum);
                        if (blankIndex === -1) return <span key={i}>_____</span>;
                        const blank = blanks[blankIndex];
                        const choices = blank.value.split("|").map((c) => {
                          const m = c.trim().match(/^([A-Z])\.\s*(.*)/);
                          return { key: m?.[1] || "", text: m?.[2] || c.trim() };
                        }).filter((c) => c.key);
                        const selectedKey = (selectedParts[blankIndex] || "").trim();
                        return (
                          <span key={i} className="mx-1 inline-block">
                            <select
                              value={selectedKey}
                              onChange={(e) => {
                                // 答案序列化与练习页/判分 API 一致：按空序逐位拼接为 "A,B,C"
                                const nextParts = blankKeys.map((k, idx) =>
                                  k === blankNum ? e.target.value : (selectedParts[idx] || "").trim()
                                );
                                if (nextParts.every((p) => !p.trim())) {
                                  // 全部清空时移除已保存的作答
                                  const rest = { ...answers };
                                  delete rest[currentQuestion.id];
                                  useExamStore.setState({ answers: rest });
                                  return;
                                }
                                // 本地预判与服务端 gradeAnswer 的 cloze 规则一致：按空序逐位比对
                                const correctParts = (currentQuestion.answer || "")
                                  .split(",")
                                  .map((s) => s.trim().toLowerCase())
                                  .filter(Boolean);
                                const isCorrect =
                                  correctParts.length > 0 &&
                                  correctParts.every(
                                    (p, idx) => (nextParts[idx] || "").trim().toLowerCase() === p
                                  );
                                handleSubmitAnswer(
                                  currentEq.id,
                                  currentQuestion.id,
                                  nextParts.join(","),
                                  isCorrect
                                );
                              }}
                              className={cn(
                                "rounded border border-border bg-background px-2 py-1 text-sm",
                                !selectedKey && "text-muted-foreground"
                              )}
                            >
                              <option value="">空 {blankNum}</option>
                              {choices.map((c) => (
                                <option key={c.key} value={c.key}>
                                  {c.key}. {c.text}
                                </option>
                              ))}
                            </select>
                          </span>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    上一题
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} / {exam.totalQuestions}
                  </span>

                  {currentIndex < exam.totalQuestions - 1 ? (
                    <Button
                      variant="outline"
                      onClick={() => setCurrentIndex(currentIndex + 1)}
                    >
                      下一题
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setShowConfirmSubmit(true)}
                    >
                      交卷
                      <Send className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Narrow-screen drawer overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Question list sidebar（窄屏为右侧抽屉，lg 及以上常驻） */}
          <div
            className={cn(
              "fixed inset-y-0 right-0 z-50 w-64 shrink-0 space-y-2 overflow-y-auto border-l bg-card p-4 transition-transform lg:static lg:translate-x-0 lg:rounded-lg lg:border",
              sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">题目列表</span>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              className="w-full"
              size="sm"
              onClick={() => setShowConfirmSubmit(true)}
            >
              <Send className="mr-2 h-3.5 w-3.5" />
              交卷
            </Button>
            <Separator />
            {exam.questions.map((eq, idx) => {
              const isAnswered = !!answers[eq.questionId];
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={eq.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full p-2 rounded-md text-sm transition-colors",
                    isCurrent
                      ? "bg-primary/10 text-primary font-medium"
                      : isAnswered
                      ? "bg-green-50 hover:bg-green-100"
                      : "hover:bg-accent text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs border",
                      isCurrent
                        ? "border-primary bg-primary text-primary-foreground"
                        : isAnswered
                        ? "border-green-300 bg-green-100 text-green-700"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="truncate flex-1">
                    {eq.question.type === "single"
                      ? "单选"
                      : eq.question.type === "multiple"
                      ? "多选"
                      : eq.question.type === "fillblank"
                      ? "填空"
                      : eq.question.type === "cloze"
                      ? "完形"
                      : "题目"}
                  </span>
                  {isAnswered && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit confirmation */}
        <AlertDialog open={showConfirmSubmit} onOpenChange={setShowConfirmSubmit}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认交卷？</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2">
                  <p>交卷后将无法修改答案。</p>
                  <p>
                    已答 {answeredCount}/{exam.totalQuestions} 题，未答{" "}
                    {exam.totalQuestions - answeredCount} 题。
                  </p>
                  {exam.totalQuestions - answeredCount > 0 && (
                    <p className="text-amber-600">
                      未答题将被计为错误。
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>继续答题</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleComplete}
                disabled={completing}
                className="bg-green-600 hover:bg-green-700"
              >
                {completing ? "提交中..." : "确认交卷"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Exit confirmation */}
        <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>退出考试？</AlertDialogTitle>
              <AlertDialogDescription>
                考试仍在进行，倒计时不暂停，稍后可从列表返回继续。是否退出？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="ghost"
                className="mr-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  setShowExitConfirm(false);
                  setShowAbandonConfirm(true);
                }}
              >
                放弃本次考试
              </Button>
              <AlertDialogCancel onClick={() => router.push("/exams")}>
                退出并稍后继续
              </AlertDialogCancel>
              <AlertDialogAction>继续考试</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Abandon confirmation */}
        <AlertDialog open={showAbandonConfirm} onOpenChange={setShowAbandonConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认放弃本次考试？</AlertDialogTitle>
              <AlertDialogDescription>
                放弃后本场考试将作废，无法继续作答，且该操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={abandoning}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAbandonExam}
                disabled={abandoning}
                className="bg-red-600 hover:bg-red-700"
              >
                {abandoning ? "放弃中..." : "确认放弃"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ABANDONED status - exam invalidated, no entry
  if (exam.status === "ABANDONED") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.push("/exams")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-bold">本场考试已放弃</h2>
            <p className="text-sm text-muted-foreground">{exam.title}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // COMPLETED status - show results
  if (exam.status === "COMPLETED") {
    const answeredCount = getAnsweredCount();
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.push("/exams")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>

        {/* Score card */}
        <Card>
          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-4">
              <span className="text-3xl font-bold text-primary">{exam.score}</span>
            </div>
            <h2 className="text-xl font-bold">考试完成</h2>
            <p className="text-muted-foreground mt-1">{exam.title}</p>
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{exam.correctCount}</p>
                <p className="text-sm text-muted-foreground">正确</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {exam.totalQuestions - exam.correctCount}
                </p>
                <p className="text-sm text-muted-foreground">错误</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{exam.totalQuestions}</p>
                <p className="text-sm text-muted-foreground">总计</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Retake */}
        {canRetake && (
          <div className="flex justify-center">
            <Button onClick={handleRetake} disabled={retaking}>
              {retaking ? (
                <>
                  <Timer className="mr-2 h-4 w-4 animate-pulse" />
                  正在创建新考试...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  再考一次
                </>
              )}
            </Button>
          </div>
        )}

        {/* Ranking */}
        {rankingsLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : rankings.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-yellow-500" />
                排行榜
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentUserRank && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">你的排名</span>
                    <Badge variant="default">{currentUserRank.rank}</Badge>
                    <span className="text-sm ml-auto">
                      得分: {currentUserRank.score}
                    </span>
                  </div>
                </div>
              )}
              {rankings.slice(0, 10).map((item) => (
                <div
                  key={`${item.userId}-${item.rank}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg",
                    item.userId === currentUserRank?.userId
                      ? "bg-primary/5 border border-primary/20"
                      : "hover:bg-accent"
                  )}
                >
                  <div className="w-8 flex justify-center">
                    {getRankBadge(item.rank)}
                  </div>
                  <span className="flex-1 font-medium text-sm truncate">
                    {item.userName}
                  </span>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-mono">
                      {item.correctCount}/{item.totalQuestions}
                    </span>
                    <span className="font-semibold text-foreground w-12 text-right">
                      {item.score}分
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Question review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">答题详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {exam.questions.map((eq, idx) => {
              const question = eq.question;
              const isCorrect = exam.status === "COMPLETED" ? eq.isCorrect : null;
              return (
                <div
                  key={eq.id}
                  className={cn(
                    "p-4 rounded-lg border",
                    isCorrect === true
                      ? "border-green-200 bg-green-50/50"
                      : isCorrect === false
                      ? "border-red-200 bg-red-50/50"
                      : "border-border"
                  )}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-sm font-medium shrink-0">第 {idx + 1} 题</span>
                    {isCorrect === true ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : isCorrect === false ? (
                      <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                    ) : null}
                    <Badge variant="outline" className="text-xs">
                      {question.type === "single"
                        ? "单选"
                        : question.type === "multiple"
                        ? "多选"
                        : question.type === "fillblank"
                        ? "填空"
                        : question.type === "truefalse"
                        ? "判断"
                        : question.type === "cloze"
                        ? "完形"
                        : "题"}
                    </Badge>
                  </div>

                  <p className="text-sm font-medium mb-2">{question.content}</p>

                  {question.options && Array.isArray(question.options) && question.options.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {question.options.map((opt: any) => {
                        const isUserSelected =
                          question.type === "multiple"
                            ? (eq.userAnswer || "").split(",").includes(opt.key)
                            : eq.userAnswer === opt.key;
                        const isCorrectAnswer =
                          question.type === "multiple"
                            ? (question.answer || "").split(",").includes(opt.key)
                            : question.answer === opt.key;

                        let optClass = "";
                        if (exam.status === "COMPLETED") {
                          if (isCorrectAnswer) optClass = "text-green-600 font-medium";
                          if (isUserSelected && !isCorrectAnswer) optClass = "text-red-600 line-through";
                        }

                        return (
                          <div
                            key={opt.key}
                            className={cn(
                              "text-sm pl-4",
                              optClass,
                              isUserSelected && exam.status === "COMPLETED" && "bg-red-50 rounded px-2 py-0.5"
                            )}
                          >
                            {opt.key}. {opt.value}
                            {isCorrectAnswer && exam.status === "COMPLETED" && " ✓"}
                            {isUserSelected && exam.status === "COMPLETED" && " ← 你的答案"}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {eq.userAnswer &&
                    (question.type === "fillblank" || question.type === "cloze") && (
                      <p className="text-sm">
                        你的答案
                        {question.type === "cloze" && "（按空序）"}:{" "}
                        <span className={isCorrect ? "text-green-600" : "text-red-600"}>
                          {eq.userAnswer}
                        </span>
                      </p>
                    )}

                  {exam.status === "COMPLETED" && (
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-green-600">
                        <span className="font-medium">正确答案: </span>
                        {question.answer}
                      </p>
                      {question.analysis && (
                        <p className="text-muted-foreground">
                          <span className="font-medium">解析: </span>
                          {question.analysis}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
