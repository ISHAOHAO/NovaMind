"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Sparkles,
  Bot,
  Shuffle,
  Send,
  CheckCircle2,
  XCircle,
  List,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  type: string;
  content: string;
  options: { key: string; value: string }[];
  answer: string;
  analysis: string;
  image?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type PracticeMode = "sequential" | "random" | "wrong";

interface AnswerResult {
  questionId: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  analysis: string;
}

export default function QuestionPracticePage() {
  const router = useRouter();
  const params = useParams();
  const bankId = params.bankId as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bankTitle, setBankTitle] = useState("");
  const [mode, setMode] = useState<PracticeMode>("sequential");

  // Answer state
  const [selectedOption, setSelectedOption] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [truefalseAnswer, setTruefalseAnswer] = useState("");
  const [fillAnswer, setFillAnswer] = useState("");
  const [clozeAnswers, setClozeAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMsg, setNoteMsg] = useState("");
  const [favored, setFavored] = useState(false);
  const [favToggling, setFavToggling] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Results
  const resultsRef = useRef<AnswerResult[]>([]);
  const [allResults, setAllResults] = useState<AnswerResult[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const sessionIdRef = useRef(crypto.randomUUID());

  const fetchQuestions = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) { router.replace("/login"); return; }

    setLoading(true);
    try {
      const bankRes = await fetch(`/api/questions/${bankId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (bankRes.ok) {
        const bd = await bankRes.json();
        setBankTitle(bd.data?.title || "");
      }

      const qRes = await fetch(`/api/questions/${bankId}/questions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (qRes.ok) {
        const qd = await qRes.json();
        setQuestions(qd.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [bankId, router]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = allResults.length;

  const resetAnswerState = () => {
    setSelectedOption("");
    setSelectedOptions([]);
    setTruefalseAnswer("");
    setFillAnswer("");
    setClozeAnswers({});
    setSubmitted(false);
    setResult(null);
    setAiResult("");
    setFavored(false);
    setNoteContent("");
    setNoteMsg("");
  };

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
    resetAnswerState();
  };

  const checkAnswer = () => {
    if (!currentQuestion) return;
    let userAnswer = "";
    let isCorrect = false;

    switch (currentQuestion.type) {
      case "single":
        userAnswer = selectedOption;
        isCorrect = selectedOption === currentQuestion.answer;
        break;
      case "multiple":
        userAnswer = selectedOptions.sort().join(",");
        const correctSorted = currentQuestion.answer.split(",").map((s) => s.trim()).sort().join(",");
        isCorrect = userAnswer === correctSorted;
        break;
      case "truefalse":
        userAnswer = truefalseAnswer;
        isCorrect = truefalseAnswer === currentQuestion.answer;
        break;
      case "fillblank":
        userAnswer = fillAnswer.trim();
        isCorrect = userAnswer.toLowerCase() === currentQuestion.answer.toLowerCase();
        break;
      case "cloze":
        const blankKeys = (currentQuestion.options as {key:string;value:string}[]).map((o) => o.key).sort((a,b) => parseInt(a)-parseInt(b));
        const clozeUserAnswers = blankKeys.map((k) => clozeAnswers[k] || "").join(",");
        userAnswer = clozeUserAnswers;
        const correctParts = currentQuestion.answer.split(",").map((s) => s.trim());
        const userParts = blankKeys.map((k) => (clozeAnswers[k] || "").trim());
        isCorrect = userParts.length === correctParts.length && userParts.every((v, i) => v === correctParts[i]);
        break;
    }

    const answerResult: AnswerResult = {
      questionId: currentQuestion.id,
      isCorrect,
      userAnswer,
      correctAnswer: currentQuestion.answer,
      analysis: currentQuestion.analysis || "",
    };

    setSubmitted(true);
    setResult(answerResult);

    resultsRef.current = [...resultsRef.current.filter((r) => r.questionId !== currentQuestion.id), answerResult];
    setAllResults([...resultsRef.current]);

    // Submit to API
    const token = localStorage.getItem("novamind_token");
    if (token) {
      fetch("/api/questions/practice/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          userAnswer,
          isCorrect,
          duration: 0,
          sessionId: sessionIdRef.current,
        }),
      }).catch(() => {});
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1);
    } else {
      setShowSummary(true);
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentQuestion) return;
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    setFavToggling(true);
    try {
      const res = await fetch("/api/questions/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionId: currentQuestion.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setFavored(data.data?.isFavorited || false);
      }
    } catch {
      // ignore
    } finally {
      setFavToggling(false);
    }
  };

  const handleSaveNote = async () => {
    if (!currentQuestion || !noteContent.trim()) return;
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    setNoteSaving(true);
    setNoteMsg("");
    try {
      const res = await fetch("/api/questions/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          content: noteContent.trim(),
        }),
      });
      if (res.ok) {
        setNoteMsg("笔记已保存");
      } else {
        setNoteMsg("保存失败");
      }
    } catch {
      setNoteMsg("网络错误");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleAiAction = async (action: "analyze" | "explain" | "similar") => {
    if (!currentQuestion) return;
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    setAiLoading(true);
    setAiResult("");
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionId: currentQuestion.id, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiResult(data.content || "AI 返回了空内容");
      } else {
        const data = await res.json();
        setAiResult(data.error || "AI 请求失败");
      }
    } catch {
      setAiResult("网络错误，请稍后重试");
    } finally {
      setAiLoading(false);
    }
  };

  const shuffleQuestions = () => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentIndex(0);
    resetAnswerState();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-muted-foreground">该题库暂无题目</p>
        <Button variant="link" onClick={() => router.push("/questions")}>
          返回题库列表
        </Button>
      </div>
    );
  }

  if (showSummary) {
    const correctCount = allResults.filter((r) => r.isCorrect).length;
    const accuracy = allResults.length > 0 ? Math.round((correctCount / allResults.length) * 100) : 0;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">练习结果</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">答题总结</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-primary">{allResults.length}</p>
                <p className="text-sm text-muted-foreground">总题数</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{correctCount}</p>
                <p className="text-sm text-muted-foreground">正确</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-600">{allResults.length - correctCount}</p>
                <p className="text-sm text-muted-foreground">错误</p>
              </div>
            </div>
            <Progress value={accuracy} className="h-3" />
            <p className="text-center text-lg font-semibold">
              正确率：{accuracy}%
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => { setShowSummary(false); setCurrentIndex(0); resetAnswerState(); }}>
                重新练习
              </Button>
              <Button variant="outline" onClick={() => router.push("/questions")}>
                返回题库
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl gap-4">
      {/* Question list sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-40 w-64 border-l bg-card transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:hidden"
        )}
      >
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-medium">题目列表</span>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[calc(100vh-10rem)] overflow-auto p-2">
          {questions.map((q, i) => {
            const qResult = allResults.find((r) => r.questionId === q.id);
            return (
              <button
                key={q.id}
                onClick={() => { goToQuestion(i); setSidebarOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                  i === currentIndex && "bg-primary/10 text-primary"
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                  {i + 1}
                </span>
                <span className="truncate">{q.content}</span>
                {qResult && (
                  qResult.isCorrect ? (
                    <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-500" />
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{bankTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {answeredCount}/{questions.length} 已答
            </p>
          </div>
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <List className="mr-1 h-4 w-4" />
            列表
          </Button>
        </div>

        <Progress value={progress} className="h-2" />

        {/* Mode tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as PracticeMode)}>
          <TabsList>
            <TabsTrigger value="sequential">顺序</TabsTrigger>
            <TabsTrigger value="random" onClick={shuffleQuestions}>
              <Shuffle className="mr-1 h-3 w-3" />
              随机
            </TabsTrigger>
            <TabsTrigger value="wrong">错题重练</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Question card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {currentIndex + 1}
                </span>
                <Badge variant="outline">
                  {currentQuestion.type === "single" && "单选题"}
                  {currentQuestion.type === "multiple" && "多选题"}
                  {currentQuestion.type === "truefalse" && "判断题"}
                  {currentQuestion.type === "fillblank" && "填空题"}
                  {currentQuestion.type === "cloze" && "完形填空"}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={favToggling}
                onClick={handleToggleFavorite}
              >
                <Heart className={cn("h-5 w-5", favored ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Question content */}
            <div className="rounded-md bg-muted/50 p-4">
              <p className="text-base whitespace-pre-wrap">{currentQuestion.content}</p>
              {currentQuestion.image && (
                <div className="mt-3">
                  <img
                    src={currentQuestion.image}
                    alt="题目图片"
                    className="max-h-80 max-w-full rounded-md border object-contain"
                  />
                </div>
              )}
            </div>

            {/* Options */}
            {currentQuestion.type === "single" && (
              <RadioGroup value={selectedOption} onValueChange={setSelectedOption} disabled={submitted} className="space-y-2">
                {currentQuestion.options?.map((opt) => (
                  <label
                    key={opt.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50",
                      submitted && opt.key === currentQuestion.answer && "border-green-500 bg-green-50",
                      submitted && selectedOption === opt.key && opt.key !== currentQuestion.answer && "border-red-500 bg-red-50",
                      submitted && selectedOption === opt.key && opt.key === currentQuestion.answer && "border-green-500 bg-green-50"
                    )}
                  >
                    <RadioGroupItem value={opt.key} />
                    <span className="font-medium">{opt.key}.</span>
                    <span>{opt.value}</span>
                  </label>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.type === "multiple" && (
              <div className="space-y-2">
                {currentQuestion.options?.map((opt) => (
                  <label
                    key={opt.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50",
                      submitted && currentQuestion.answer.includes(opt.key) && "border-green-500 bg-green-50",
                      submitted && selectedOptions.includes(opt.key) && !currentQuestion.answer.includes(opt.key) && "border-red-500 bg-red-50"
                    )}
                  >
                    <Checkbox
                      checked={selectedOptions.includes(opt.key)}
                      disabled={submitted}
                      onCheckedChange={(checked) => {
                        setSelectedOptions((prev) =>
                          checked ? [...prev, opt.key] : prev.filter((k) => k !== opt.key)
                        );
                      }}
                    />
                    <span className="font-medium">{opt.key}.</span>
                    <span>{opt.value}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.type === "truefalse" && (
              <div className="flex gap-3">
                {["true", "false"].map((val) => (
                  <Button
                    key={val}
                    variant={truefalseAnswer === val ? "default" : "outline"}
                    className={cn(
                      "flex-1 py-8 text-lg",
                      submitted && val === currentQuestion.answer && "bg-green-500 hover:bg-green-500",
                      submitted && truefalseAnswer === val && val !== currentQuestion.answer && "bg-red-500 hover:bg-red-500"
                    )}
                    disabled={submitted}
                    onClick={() => setTruefalseAnswer(val)}
                  >
                    {val === "true" ? "正确" : "错误"}
                  </Button>
                ))}
              </div>
            )}

            {currentQuestion.type === "fillblank" && (
              <div className="space-y-2">
                <Input
                  value={fillAnswer}
                  onChange={(e) => setFillAnswer(e.target.value)}
                  disabled={submitted}
                  placeholder="请输入答案..."
                  className={cn(
                    submitted && result?.isCorrect && "border-green-500 bg-green-50",
                    submitted && !result?.isCorrect && "border-red-500 bg-red-50"
                  )}
                />
                {submitted && currentQuestion.answer && (
                  <p className="text-sm text-muted-foreground">
                    正确答案：{currentQuestion.answer}
                  </p>
                )}
              </div>
            )}

            {currentQuestion.type === "cloze" && (
              <div className="space-y-4">
                {(() => {
                  const passage = currentQuestion.content;
                  const blanks = (currentQuestion.options as {key:string;value:string}[]).sort((a,b) => parseInt(a.key)-parseInt(b.key));
                  const parts = passage.split(/_{2,}\(?(\d+)\)?_{2,}/g);
                  return (
                    <div className="leading-relaxed text-base">
                      {parts.map((part, i) => {
                        if (i % 2 === 0) {
                          return <span key={i}>{part}</span>;
                        }
                        const blankNum = part;
                        const blank = blanks.find((b) => b.key === blankNum);
                        if (!blank) return <span key={i}>_____</span>;
                        const choices = blank.value.split("|").map((c) => {
                          const m = c.trim().match(/^([A-Z])\.\s*(.*)/);
                          return { key: m?.[1] || "", text: m?.[2] || c.trim() };
                        }).filter((c) => c.key);
                        const selectedKey = clozeAnswers[blankNum] || "";
                        const isCorrectBlank = submitted && selectedKey === (currentQuestion.answer.split(",").map((s) => s.trim())[blanks.findIndex((b) => b.key === blankNum)] || "");
                        return (
                          <span key={i} className="inline-block mx-1">
                            <select
                              value={selectedKey}
                              onChange={(e) => setClozeAnswers((prev) => ({ ...prev, [blankNum]: e.target.value }))}
                              disabled={submitted}
                              className={cn(
                                "rounded border px-2 py-1 text-sm",
                                !submitted && "bg-background",
                                submitted && isCorrectBlank && "border-green-500 bg-green-100",
                                submitted && !isCorrectBlank && "border-red-500 bg-red-100"
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
                      })}
                    </div>
                  );
                })()}
                {submitted && currentQuestion.answer && (
                  <p className="text-sm text-muted-foreground">
                    正确答案：{currentQuestion.answer}
                  </p>
                )}
              </div>
            )}

            {/* Result */}
            {submitted && result && (
              <div className={cn(
                "rounded-md border p-4",
                result.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
              )}>
                <div className="flex items-center gap-2">
                  {result.isCorrect ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-700">回答正确！</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-700">回答错误</span>
                    </>
                  )}
                </div>
                {result.analysis && (
                  <div className="mt-3 rounded-md bg-white p-3">
                    <p className="text-sm font-medium">解析：</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{result.analysis}</p>
                  </div>
                )}
              </div>
            )}

            {/* AI result */}
            {aiResult && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">AI 响应</span>
                </div>
                {aiResult.startsWith("<") ? (
                  <div
                    className="ai-content text-sm"
                    dangerouslySetInnerHTML={{ __html: aiResult }}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{aiResult}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!submitted ? (
            <Button
              onClick={checkAnswer}
              disabled={
                (currentQuestion.type === "single" && !selectedOption) ||
                (currentQuestion.type === "multiple" && selectedOptions.length === 0) ||
                (currentQuestion.type === "truefalse" && !truefalseAnswer) ||
                (currentQuestion.type === "fillblank" && !fillAnswer.trim()) ||
                (currentQuestion.type === "cloze" && currentQuestion.options && (currentQuestion.options as {key:string;value:string}[]).some((o) => !clozeAnswers[o.key]))
              }
            >
              <Send className="mr-2 h-4 w-4" />
              提交答案
            </Button>
          ) : (
            <Button onClick={handleNext}>
              {currentIndex < questions.length - 1 ? (
                <>
                  下一题
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  查看结果
                  <CheckCircle2 className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={aiLoading}
            onClick={() => handleAiAction("analyze")}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            AI解析
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={aiLoading}
            onClick={() => handleAiAction("explain")}
          >
            <Bot className="mr-1 h-4 w-4" />
            AI讲解
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={aiLoading}
            onClick={() => handleAiAction("similar")}
          >
            <Shuffle className="mr-1 h-4 w-4" />
            生成相似题
          </Button>
        </div>

        {aiLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            AI 思考中...
          </div>
        )}

        <Separator />

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => goToQuestion(currentIndex - 1)}
            disabled={currentIndex <= 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一题
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {questions.length}
          </span>
          <Button
            variant="outline"
            onClick={() => goToQuestion(currentIndex + 1)}
            disabled={currentIndex >= questions.length - 1}
          >
            下一题
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="note">笔记</Label>
          <Textarea
            id="note"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="为这道题添加笔记..."
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSaveNote} disabled={noteSaving || !noteContent.trim()}>
              {noteSaving ? "保存中..." : "保存笔记"}
            </Button>
            {noteMsg && <span className="text-xs text-muted-foreground">{noteMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
