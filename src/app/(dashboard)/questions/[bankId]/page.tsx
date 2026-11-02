"use client";

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Sparkles,
  Bot,
  Shuffle,
  Send,
  CheckCircle2,
  Copy,
  XCircle,
  List,
  LayoutGrid,
  Flag,
  RefreshCcw,
  Square,
  X,
  AlertTriangle,
  Loader2,
  StickyNote,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { sanitizeAiHtml } from "@/lib/sanitize-html";

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

type PracticeMode = "sequential" | "random" | "wrong" | "review";

interface AnswerResult {
  questionId: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  analysis: string;
  /** 服务端判分同步状态：true=已按服务端判定为准；false=上报失败，本地判定兜底 */
  synced?: boolean;
}

/** 单题草稿（含未提交的作答与已提交的结果），切题时保留 */
interface AnswerDraft {
  selectedOption: string;
  selectedOptions: string[];
  truefalseAnswer: string;
  fillAnswer: string;
  clozeAnswers: Record<string, string>;
  submitted: boolean;
  result: AnswerResult | null;
}

const EMPTY_DRAFT: AnswerDraft = {
  selectedOption: "",
  selectedOptions: [],
  truefalseAnswer: "",
  fillAnswer: "",
  clozeAnswers: {},
  submitted: false,
  result: null,
};

/** localStorage 练习进度（Map/Set 均转为普通对象/数组存储） */
interface PersistedProgress {
  mode: PracticeMode;
  ids: string[];
  displayOrder: number[];
  currentIndex: number;
  answers: Record<string, AnswerDraft>;
  results: AnswerResult[];
  marked: string[];
  savedAt: number;
}

// 侧栏一次最多渲染的题目数：大题库（数千题）时避免生成上万 DOM 节点
const SIDEBAR_WINDOW = 200;
// 详情懒加载分页大小（与后端 offset/limit 上限 300 对齐）
const PAGE_SIZE = 200;
// 错题列表分页拉取的页数上限（history 接口单页上限 100 条）
const WRONG_HISTORY_MAX_PAGES = 50;

function getProgressKey(bankId: string): string {
  return `novamind_practice_${bankId}`;
}

function shuffleIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 焦点在输入类元素时忽略快捷键 */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

/** 数字 1-9 / 字母 A-J → 选项 key */
function optionKeyFromEvent(e: KeyboardEvent, options: { key: string; value: string }[]): string | null {
  if (!options || options.length === 0) return null;
  if (/^[1-9]$/.test(e.key)) {
    const idx = parseInt(e.key, 10) - 1;
    return options[idx]?.key ?? null;
  }
  const letter = e.key.toUpperCase();
  if (/^[A-J]$/.test(letter)) {
    const found = options.find((o) => o.key.toUpperCase() === letter);
    return found?.key ?? null;
  }
  return null;
}

type AiAction = "analyze" | "explain" | "similar";

/** 试用用户当日 AI 额度（done 事件携带，正式用户为 null） */
interface AiUsage {
  used: number;
  limit: number;
}

const AI_ACTION_LABELS: Record<AiAction, string> = {
  analyze: "AI 解析",
  explain: "AI 讲解",
  similar: "AI 相似题",
};

function aiCacheKey(questionId: string, action: AiAction): string {
  return `${questionId}|${action}`;
}

/** 解析单个 SSE 事件块（按空行分隔，提取 event: 与 data: 行） */
function parseSseEvent(block: string): { event: string; data: Record<string, unknown> } | null {
  let event = "";
  let dataRaw = "";
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataRaw += line.slice(5).trim();
    }
  }
  if (!dataRaw) return null;
  try {
    return { event: event || "message", data: JSON.parse(dataRaw) as Record<string, unknown> };
  } catch {
    return null;
  }
}

function parseAiUsage(value: unknown): AiUsage | null {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.used === "number" && typeof obj.limit === "number") {
      return { used: obj.used, limit: obj.limit };
    }
  }
  return null;
}

function PracticeContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const bankId = params.bankId as string;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  // 题库题目按 sortOrder 的有序 ID 列表（轻量接口，初始即加载）
  const [idList, setIdList] = useState<string[]>([]);
  // 题目详情缓存（按题目 ID）：大题库按页/按需加载，避免一次性拉取全库
  const [details, setDetails] = useState<Map<string, Question>>(new Map());
  // 展示顺序 → idList 下标的映射（顺序练习为恒等排列，随机练习为打乱后的排列）
  const [displayOrder, setDisplayOrder] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // 侧栏当前渲染窗口的起始位置（仅题目数超过 SIDEBAR_WINDOW 时生效）
  const [sidebarStart, setSidebarStart] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bankTitle, setBankTitle] = useState("");
  const [mode, setMode] = useState<PracticeMode>("sequential");

  // 当前题草稿 + 全部题草稿 map（切题保留未提交作答）
  const [draft, setDraft] = useState<AnswerDraft>({ ...EMPTY_DRAFT });
  const draftRef = useRef<AnswerDraft>(draft);
  const [drafts, setDrafts] = useState<Map<string, AnswerDraft>>(new Map());
  const draftsRef = useRef<Map<string, AnswerDraft>>(drafts);

  // 本库收藏题 id 集合（进入题库时一次性拉取，切换收藏后同步维护）
  const [favoritesSet, setFavoritesSet] = useState<Set<string>>(new Set());
  // 标记待复查（纯前端状态，questionId 集合，随进度持久化）
  const [marked, setMarked] = useState<Set<string>>(new Set());

  const [noteContent, setNoteContent] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMsg, setNoteMsg] = useState("");
  const [noteImportance, setNoteImportance] = useState(0);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [hasExistingNote, setHasExistingNote] = useState(false);
  const [favToggling, setFavToggling] = useState(false);
  // AI 面板：流式增量写入 aiResult；aiAction 为当前展示的动作（null 表示面板收起）
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | null>(null);
  const [aiResult, setAiResult] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiDisabled, setAiDisabled] = useState(false); // 管理员未开启 AI 功能时展示占位
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  // 本次会话内按题缓存各动作的结果（questionId|action → HTML），切题回来不丢、不重复请求
  const aiCacheRef = useRef<Map<string, string>>(new Map());
  // 每题最后查看的动作，切题回来时恢复对应面板
  const aiLastActionRef = useRef<Map<string, AiAction>>(new Map());
  const aiAbortRef = useRef<AbortController | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<"list" | "grid">("list");

  // Report
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);

  // Results
  const resultsRef = useRef<AnswerResult[]>([]);
  const [allResults, setAllResults] = useState<AnswerResult[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const sessionIdRef = useRef(crypto.randomUUID());
  // 进入题目时的时间戳，提交时算差值作为真实耗时
  const questionStartRef = useRef<number>(Date.now());

  // 错题重练 / 复习模式的题目 id 列表与就绪标记（用于空态文案）
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [wrongLoaded, setWrongLoaded] = useState(false);
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [modePreparing, setModePreparing] = useState(false);

  // 查看总结前的未答题确认
  const [confirmSummaryOpen, setConfirmSummaryOpen] = useState(false);
  const [pendingUnanswered, setPendingUnanswered] = useState(0);

  // 进度恢复 / 深链参数只应用一次
  const hydratedRef = useRef(false);
  const initialParamsAppliedRef = useRef(false);

  // 懒加载：已请求过的页（按题库顺序分页）与进行中的请求
  const fetchedPagesRef = useRef<Set<number>>(new Set());
  const inFlightPagesRef = useRef<Set<number>>(new Set());

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("novamind_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  /** 按题库顺序分页拉取题目详情，合并进 details 缓存 */
  const loadPage = useCallback(async (pageIdx: number): Promise<boolean> => {
    if (pageIdx < 0) return false;
    if (fetchedPagesRef.current.has(pageIdx) || inFlightPagesRef.current.has(pageIdx)) return true;
    const start = pageIdx * PAGE_SIZE;
    if (start >= idList.length) return false;
    inFlightPagesRef.current.add(pageIdx);
    try {
      const limit = Math.min(PAGE_SIZE, idList.length - start);
      const res = await fetch(
        `/api/questions/${bankId}/questions?offset=${start}&limit=${limit}`,
        { headers: authHeaders() }
      );
      if (!res.ok) return false;
      const qd = await res.json();
      const list: Question[] = qd.data || [];
      fetchedPagesRef.current.add(pageIdx);
      setDetails((prev) => {
        const next = new Map(prev);
        list.forEach((q) => next.set(q.id, q));
        return next;
      });
      return true;
    } catch {
      return false;
    } finally {
      inFlightPagesRef.current.delete(pageIdx);
    }
  }, [bankId, idList.length, authHeaders]);

  /** 按需拉取单题详情（随机/错题/复习模式下题目散布各页，单题拉取最省流量） */
  const fetchDetail = useCallback(async (questionId: string): Promise<Question | null> => {
    try {
      const res = await fetch(`/api/questions/${bankId}/questions/${questionId}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      const qd = await res.json();
      const q: Question | null = qd.data || null;
      if (q) {
        setDetails((prev) => new Map(prev).set(q.id, q));
      }
      return q;
    } catch {
      return null;
    }
  }, [bankId, authHeaders]);

  /** 确保展示位 index 的题目可用：顺序模式按页预取，其余模式单题按需 */
  const ensureAt = useCallback((displayIdx: number) => {
    if (displayIdx < 0 || displayIdx >= displayOrder.length) return;
    const bankIdx = displayOrder[displayIdx];
    const questionId = idList[bankIdx];
    if (!questionId) return;
    const pageIdx = Math.floor(bankIdx / PAGE_SIZE);

    if (mode === "sequential") {
      // 顺序练习：展示序 == 题库序，整页拉取 + 预取下一页
      loadPage(pageIdx);
      loadPage(pageIdx + 1);
    } else {
      // 随机/错题/复习模式：题目散布，仅拉当前题与相邻展示位的单题
      if (!details.has(questionId)) fetchDetail(questionId);
      const nextId = idList[displayOrder[displayIdx + 1] ?? -1];
      if (nextId && !details.has(nextId)) fetchDetail(nextId);
    }
  }, [displayOrder, idList, mode, details, loadPage, fetchDetail]);

  /** 侧栏窗口内缺失的题目补拉：顺序模式整页拉取更高效，其余模式小批量并发补单题 */
  const fillWindow = useCallback((start: number) => {
    if (displayOrder.length === 0) return;
    if (mode === "sequential") {
      const firstPage = Math.floor(start / PAGE_SIZE);
      const lastPage = Math.floor(Math.min(start + SIDEBAR_WINDOW - 1, displayOrder.length - 1) / PAGE_SIZE);
      for (let p = firstPage; p <= lastPage; p++) {
        loadPage(p);
      }
      return;
    }
    const missingIds: string[] = [];
    const end = Math.min(start + SIDEBAR_WINDOW, displayOrder.length);
    for (let i = start; i < end; i++) {
      const id = idList[displayOrder[i]];
      if (id && !details.has(id)) missingIds.push(id);
    }
    if (missingIds.length === 0) return;
    const CONCURRENCY = 8;
    let cursor = 0;
    const worker = async () => {
      while (cursor < missingIds.length) {
        const id = missingIds[cursor++];
        await fetchDetail(id);
      }
    };
    for (let w = 0; w < Math.min(CONCURRENCY, missingIds.length); w++) {
      worker();
    }
  }, [displayOrder, idList, details, mode, loadPage, fetchDetail]);

  /** 进入题库时一次性拉取本库收藏题 id 集合，用于收藏状态回显 */
  const loadFavorites = useCallback(async () => {
    try {
      const res = await fetch(`/api/questions/favorites?bankId=${bankId}&ids=1`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: { questionId: string }[] = data.favorites || [];
      setFavoritesSet(new Set(list.map((f) => f.questionId)));
    } catch {
      // ignore
    }
  }, [bankId, authHeaders]);

  /** 分页拉取本库全部错题 id（历史记录按时间倒序，最近答错的排前） */
  const fetchWrongIds = useCallback(async (): Promise<string[]> => {
    const seen = new Set<string>();
    const ids: string[] = [];
    try {
      for (let page = 1; page <= WRONG_HISTORY_MAX_PAGES; page++) {
        const res = await fetch(
          `/api/questions/practice/history?bankId=${bankId}&isCorrect=false&page=${page}&limit=100`,
          { headers: authHeaders() }
        );
        if (!res.ok) break;
        const data = await res.json();
        const records: { questionId: string }[] = data.data || [];
        for (const r of records) {
          if (r?.questionId && !seen.has(r.questionId)) {
            seen.add(r.questionId);
            ids.push(r.questionId);
          }
        }
        const totalPages: number = data.pagination?.totalPages ?? 1;
        if (page >= totalPages) break;
      }
    } catch {
      // ignore，返回已收集部分
    }
    return ids;
  }, [bankId, authHeaders]);

  /** 拉取按遗忘曲线到期的复习题 id（到期时间升序） */
  const fetchReviewIds = useCallback(async (): Promise<string[]> => {
    try {
      const res = await fetch(`/api/questions/review-due?bankId=${bankId}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.questionIds) ? data.questionIds : [];
    } catch {
      return [];
    }
  }, [bankId, authHeaders]);

  /** 中止进行中的 AI 请求并收起面板（按题缓存保留） */
  const resetAiPanel = useCallback(() => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiAction(null);
    setAiResult("");
    setAiError("");
    setAiLoading(false);
  }, []);

  /** 切题后按缓存恢复 AI 面板：该题此前生成过则回显对应动作，否则收起 */
  const restoreAiForQuestion = useCallback((questionId: string | undefined) => {
    const lastAction = questionId ? aiLastActionRef.current.get(questionId) : undefined;
    const cached =
      questionId && lastAction
        ? aiCacheRef.current.get(aiCacheKey(questionId, lastAction))
        : undefined;
    if (lastAction && cached !== undefined) {
      setAiAction(lastAction);
      setAiResult(cached);
      setAiError("");
    } else {
      setAiAction(null);
      setAiResult("");
      setAiError("");
    }
  }, []);

  /** 重置整场练习（切换模式/重新开始时调用） */
  const applyOrder = useCallback((order: number[]) => {
    setDisplayOrder(order);
    setCurrentIndex(0);
    setSidebarStart(0);
    resultsRef.current = [];
    setAllResults([]);
    setMarked(new Set());
    draftsRef.current = new Map();
    setDrafts(new Map());
    draftRef.current = { ...EMPTY_DRAFT };
    setDraft({ ...EMPTY_DRAFT });
    resetAiPanel();
    questionStartRef.current = Date.now();
  }, [resetAiPanel]);

  const setDraftState = useCallback((next: AnswerDraft) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const updateDraft = useCallback((patch: Partial<AnswerDraft>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
  }, []);

  const putDraft = useCallback((questionId: string, d: AnswerDraft) => {
    const next = new Map(draftsRef.current);
    next.set(questionId, d);
    draftsRef.current = next;
    setDrafts(next);
  }, []);

  const clearSavedProgress = useCallback(() => {
    try {
      localStorage.removeItem(getProgressKey(bankId));
    } catch {
      // ignore
    }
  }, [bankId]);

  /** 进入页面时恢复上次练习进度（题库题目未变化且未完成时） */
  const tryRestoreProgress = useCallback((ids: string[]): boolean => {
    try {
      const raw = localStorage.getItem(getProgressKey(bankId));
      if (!raw) return false;
      const saved = JSON.parse(raw) as PersistedProgress;
      const validModes: PracticeMode[] = ["sequential", "random", "wrong", "review"];
      if (!validModes.includes(saved.mode)) {
        localStorage.removeItem(getProgressKey(bankId));
        return false;
      }
      const sameBank =
        Array.isArray(saved.ids) &&
        saved.ids.length === ids.length &&
        saved.ids.every((v, i) => v === ids[i]);
      const validOrder =
        Array.isArray(saved.displayOrder) &&
        saved.displayOrder.length > 0 &&
        saved.displayOrder.every((i) => Number.isInteger(i) && i >= 0 && i < ids.length);
      if (!sameBank || !validOrder) {
        localStorage.removeItem(getProgressKey(bankId));
        return false;
      }

      const idx = Math.min(Math.max(0, saved.currentIndex), saved.displayOrder.length - 1);
      const draftMap = new Map<string, AnswerDraft>();
      if (saved.answers && typeof saved.answers === "object") {
        for (const [qid, d] of Object.entries(saved.answers)) {
          if (d && typeof d === "object") {
            draftMap.set(qid, { ...EMPTY_DRAFT, ...d, clozeAnswers: d.clozeAnswers || {} });
          }
        }
      }
      draftsRef.current = draftMap;
      setDrafts(draftMap);

      const curId = ids[saved.displayOrder[idx]];
      const curDraft = curId ? draftMap.get(curId) : undefined;
      draftRef.current = curDraft ? { ...curDraft } : { ...EMPTY_DRAFT };
      setDraft(draftRef.current);

      setMode(saved.mode);
      setDisplayOrder(saved.displayOrder);
      setCurrentIndex(idx);
      const savedResults = Array.isArray(saved.results) ? saved.results : [];
      resultsRef.current = savedResults;
      setAllResults(savedResults);
      setMarked(new Set(Array.isArray(saved.marked) ? saved.marked : []));
      toast.success("已恢复上次练习进度");
      return true;
    } catch {
      return false;
    }
  }, [bankId]);

  const fetchQuestions = useCallback(async () => {
    const token = localStorage.getItem("novamind_token");
    if (!token) { router.replace("/login"); return; }

    setLoading(true);
    fetchedPagesRef.current = new Set();
    inFlightPagesRef.current = new Set();
    try {
      const bankRes = await fetch(`/api/questions/${bankId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (bankRes.ok) {
        const bd = await bankRes.json();
        setBankTitle(bd.data?.title || "");
      }

      // 初始只拉轻量 ID 列表 + 第一页详情，其余按需加载
      const idsRes = await fetch(`/api/questions/${bankId}/questions?fields=ids`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (idsRes.ok) {
        const idsData = await idsRes.json();
        const ids: string[] = idsData.data || [];
        setIdList(ids);
        loadFavorites();

        if (ids.length > 0) {
          const limit = Math.min(PAGE_SIZE, ids.length);
          const pageRes = await fetch(
            `/api/questions/${bankId}/questions?offset=0&limit=${limit}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (pageRes.ok) {
            const qd = await pageRes.json();
            const list: Question[] = qd.data || [];
            fetchedPagesRef.current.add(0);
            setDetails(new Map(list.map((q) => [q.id, q])));
          }

          // 深链参数优先；无深链时才尝试恢复上次进度，无进度则进入顺序练习
          const sp = searchParamsRef.current;
          const hasDeepLink = !!(sp.get("filter") || sp.get("questionId"));
          const restored = !hasDeepLink ? tryRestoreProgress(ids) : false;
          if (!restored) {
            setDisplayOrder(ids.map((_, i) => i));
          }
        }
      }
    } catch {
      // ignore
    } finally {
      hydratedRef.current = true;
      questionStartRef.current = Date.now();
      setLoading(false);
    }
  }, [bankId, router, loadFavorites, tryRestoreProgress]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // 切库时清空按题 AI 缓存与面板；切库/卸载时中止进行中的 AI 请求
  useEffect(() => {
    aiCacheRef.current = new Map();
    aiLastActionRef.current = new Map();
    setAiAction(null);
    setAiResult("");
    setAiError("");
    setAiLoading(false);
    setAiUsage(null);
    return () => {
      aiAbortRef.current?.abort();
      aiAbortRef.current = null;
    };
  }, [bankId]);

  const currentQuestion = displayOrder.length > 0
    ? details.get(idList[displayOrder[currentIndex]] ?? "") ?? null
    : null;
  const progress = displayOrder.length > 0 ? ((currentIndex + 1) / displayOrder.length) * 100 : 0;
  const answeredCount = allResults.length;
  const favored = currentQuestion ? favoritesSet.has(currentQuestion.id) : false;

  // 答题结果按题目 ID 建索引，侧栏渲染时 O(1) 查询（此前为逐项 find）
  const resultByQuestionId = useMemo(
    () => new Map(allResults.map((r) => [r.questionId, r])),
    [allResults]
  );

  // 未答题数量（用于查看总结前的确认弹窗）
  const unansweredCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < displayOrder.length; i++) {
      const qid = idList[displayOrder[i]];
      if (qid && !resultByQuestionId.has(qid)) count++;
    }
    return count;
  }, [displayOrder, idList, resultByQuestionId]);

  useEffect(() => {
    if (currentQuestion) {
      fetchExistingNote(currentQuestion.id);
    }
  }, [currentQuestion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 练习进度持久化：完成本次练习（showSummary）或切换模式（applyOrder 内不保存旧值）时由 clearSavedProgress 清除
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (loading || showSummary || modePreparing) return;
    if (displayOrder.length === 0) return;
    const answers: Record<string, AnswerDraft> = {};
    drafts.forEach((d, qid) => {
      answers[qid] = d;
    });
    const payload: PersistedProgress = {
      mode,
      ids: idList,
      displayOrder,
      currentIndex,
      answers,
      results: resultsRef.current,
      marked: Array.from(marked),
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(getProgressKey(bankId), JSON.stringify(payload));
    } catch {
      // ignore（存储空间不足等）
    }
  }, [loading, showSummary, modePreparing, mode, displayOrder, currentIndex, drafts, marked, allResults, idList, bankId]);

  // 深链参数：?filter=wrong|review 自动切模式；?questionId= 定位到该题
  useEffect(() => {
    if (loading || initialParamsAppliedRef.current) return;
    initialParamsAppliedRef.current = true;

    const sp = searchParamsRef.current;
    const filter = sp.get("filter");
    const questionId = sp.get("questionId");

    if (filter === "wrong" || filter === "review") {
      void handleModeChange(filter);
      return;
    }

    if (questionId && idList.length > 0) {
      const bankIdx = idList.indexOf(questionId);
      if (bankIdx < 0) {
        toast.error("未找到该题目");
        return;
      }
      const displayIdx = displayOrder.findIndex((bi) => idList[bi] === questionId);
      if (displayIdx >= 0) {
        goToQuestion(displayIdx);
      } else {
        // 当前展示序列不含该题（如处于错题/复习子集），回退到全库顺序后定位
        applyOrder(idList.map((_, i) => i));
        setCurrentIndex(bankIdx);
        questionStartRef.current = Date.now();
      }
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchExistingNote = useCallback(async (questionId: string) => {
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    try {
      const res = await fetch(`/api/questions/notes?questionId=${questionId}&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const note = data.data[0];
          setNoteContent(note.content);
          setNoteImportance(note.importance);
          setHasExistingNote(true);
          setNotePanelOpen(true);
        } else {
          setNoteContent("");
          setNoteImportance(0);
          setHasExistingNote(false);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  /** 切题：当前作答保存进草稿 map，恢复目标题的草稿（未提交作答不丢失） */
  const goToQuestion = useCallback((index: number) => {
    if (index < 0 || index >= displayOrder.length) return;
    const curBankIdx = displayOrder[currentIndex];
    const curId = curBankIdx !== undefined ? idList[curBankIdx] : undefined;
    if (curId) putDraft(curId, draftRef.current);

    const targetBankIdx = displayOrder[index];
    const targetId = targetBankIdx !== undefined ? idList[targetBankIdx] : undefined;
    const targetDraft = targetId ? draftsRef.current.get(targetId) : undefined;
    draftRef.current = targetDraft ? { ...targetDraft } : { ...EMPTY_DRAFT };
    setDraft(draftRef.current);

    setCurrentIndex(index);
    restoreAiForQuestion(targetId);
    setNoteMsg("");
    ensureAt(index);
    questionStartRef.current = Date.now();
  }, [displayOrder, currentIndex, idList, putDraft, ensureAt, restoreAiForQuestion]);

  /** 服务端判分结果回填：以服务端返回的 isCorrect 为准 */
  const applyVerdict = useCallback((questionId: string, updated: AnswerResult) => {
    resultsRef.current = resultsRef.current.map((r) =>
      r.questionId === questionId ? updated : r
    );
    setAllResults([...resultsRef.current]);

    const stored = draftsRef.current.get(questionId);
    if (stored && stored.result?.questionId === questionId) {
      putDraft(questionId, { ...stored, result: updated });
    }
    if (draftRef.current.result?.questionId === questionId) {
      updateDraft({ result: updated });
    }
  }, [putDraft, updateDraft]);

  /** 上传答题记录；服务端重算 isCorrect，失败时保留本地判定并标记未同步 */
  const submitRecord = useCallback(async (questionId: string, userAnswer: string, duration: number, local: AnswerResult) => {
    try {
      const res = await fetch("/api/questions/practice/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          questionId,
          userAnswer,
          duration,
          sessionId: sessionIdRef.current,
        }),
      });
      if (!res.ok) throw new Error("record failed");
      const data = await res.json();
      applyVerdict(questionId, { ...local, isCorrect: data.data?.isCorrect === true, synced: true });
    } catch {
      applyVerdict(questionId, { ...local, synced: false });
    }
  }, [authHeaders, applyVerdict]);

  const checkAnswer = useCallback(() => {
    if (!currentQuestion) return;
    const q = currentQuestion;
    let userAnswer = "";
    let isCorrect = false;

    switch (q.type) {
      case "single":
        userAnswer = draft.selectedOption;
        isCorrect = draft.selectedOption === q.answer;
        break;
      case "multiple":
        userAnswer = [...draft.selectedOptions].sort().join(",");
        const correctSorted = q.answer.split(",").map((s) => s.trim()).sort().join(",");
        isCorrect = userAnswer === correctSorted;
        break;
      case "truefalse":
        userAnswer = draft.truefalseAnswer;
        isCorrect = draft.truefalseAnswer === q.answer;
        break;
      case "fillblank":
        userAnswer = draft.fillAnswer.trim();
        isCorrect = userAnswer.toLowerCase() === q.answer.toLowerCase();
        break;
      case "cloze": {
        const blankKeys = (q.options as { key: string; value: string }[]).map((o) => o.key).sort((a, b) => parseInt(a) - parseInt(b));
        userAnswer = blankKeys.map((k) => draft.clozeAnswers[k] || "").join(",");
        const correctParts = q.answer.split(",").map((s) => s.trim());
        const userParts = blankKeys.map((k) => (draft.clozeAnswers[k] || "").trim());
        isCorrect = userParts.length === correctParts.length && userParts.every((v, i) => v === correctParts[i]);
        break;
      }
    }

    // 真实耗时：进入题目 → 提交答案的时间差
    const duration = Math.max(0, Date.now() - questionStartRef.current);

    const answerResult: AnswerResult = {
      questionId: q.id,
      isCorrect,
      userAnswer,
      correctAnswer: q.answer,
      analysis: q.analysis || "",
    };

    setDraftState({ ...draftRef.current, submitted: true, result: answerResult });
    if (q.id) putDraft(q.id, { ...draftRef.current });

    resultsRef.current = [...resultsRef.current.filter((r) => r.questionId !== q.id), answerResult];
    setAllResults([...resultsRef.current]);

    void submitRecord(q.id, userAnswer, duration, answerResult);
  }, [currentQuestion, draft, setDraftState, putDraft, submitRecord]);

  const openSummary = useCallback(() => {
    setShowSummary(true);
    clearSavedProgress();
  }, [clearSavedProgress]);

  const handleNext = useCallback(() => {
    if (currentIndex < displayOrder.length - 1) {
      goToQuestion(currentIndex + 1);
    } else if (unansweredCount > 0) {
      setPendingUnanswered(unansweredCount);
      setConfirmSummaryOpen(true);
    } else {
      openSummary();
    }
  }, [currentIndex, displayOrder.length, goToQuestion, unansweredCount, openSummary]);

  const toggleMarked = useCallback((questionId: string) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback(async () => {
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
        const isFav = data.data?.isFavorited === true;
        setFavoritesSet((prev) => {
          const next = new Set(prev);
          if (isFav) {
            next.add(currentQuestion.id);
          } else {
            next.delete(currentQuestion.id);
          }
          return next;
        });
        toast.success(data.message || (isFav ? "已收藏" : "已取消收藏"));
      }
    } catch {
      // ignore
    } finally {
      setFavToggling(false);
    }
  }, [currentQuestion]);

  /** 切换练习模式（顺序/随机/错题重练/复习） */
  const handleModeChange = async (newModeRaw: string) => {
    const newMode = newModeRaw as PracticeMode;
    if (newMode === mode) return;
    clearSavedProgress();
    setShowSummary(false);
    setMode(newMode);

    if (newMode === "sequential") {
      applyOrder(idList.map((_, i) => i));
      return;
    }
    if (newMode === "random") {
      applyOrder(shuffleIndices(idList.length));
      return;
    }

    // 错题重练 / 复习：拉取对应题目 id 列表
    setModePreparing(true);
    try {
      const ids = newMode === "wrong" ? await fetchWrongIds() : await fetchReviewIds();
      if (newMode === "wrong") {
        setWrongIds(ids);
        setWrongLoaded(true);
      } else {
        setReviewIds(ids);
        setReviewLoaded(true);
      }
      const order = ids
        .map((id) => idList.indexOf(id))
        .filter((i) => i >= 0);
      applyOrder(order);
    } finally {
      setModePreparing(false);
    }
  };

  /** 已处于随机模式时再次点击随机 Tab：重新打乱（保留已答结果） */
  const reshuffleRandom = () => {
    setDisplayOrder((prev) => {
      const indices = [...prev];
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      return indices;
    });
    setCurrentIndex(0);
    resetAiPanel();
    questionStartRef.current = Date.now();
  };

  /** 按当前模式重新开始一场练习 */
  const restartPractice = () => {
    setShowSummary(false);
    clearSavedProgress();
    if (mode === "sequential") {
      applyOrder(idList.map((_, i) => i));
    } else if (mode === "random") {
      applyOrder(shuffleIndices(idList.length));
    } else {
      const ids = mode === "wrong" ? wrongIds : reviewIds;
      applyOrder(ids.map((id) => idList.indexOf(id)).filter((i) => i >= 0));
    }
  };

  /** 只重练本次答错的题 */
  const retryWrongOnly = () => {
    const wrongQuestionIds = allResults.filter((r) => !r.isCorrect).map((r) => r.questionId);
    if (wrongQuestionIds.length === 0) {
      toast.success("本次没有错题，无需重练");
      return;
    }
    setShowSummary(false);
    clearSavedProgress();
    applyOrder(wrongQuestionIds.map((id) => idList.indexOf(id)).filter((i) => i >= 0));
    toast.success(`已生成本次错题重练（${wrongQuestionIds.length} 题）`);
  };

  const canSubmit = useMemo(() => {
    if (!currentQuestion || draft.submitted) return false;
    switch (currentQuestion.type) {
      case "single":
        return !!draft.selectedOption;
      case "multiple":
        return draft.selectedOptions.length > 0;
      case "truefalse":
        return !!draft.truefalseAnswer;
      case "fillblank":
        return !!draft.fillAnswer.trim();
      case "cloze":
        return (
          !currentQuestion.options ||
          (currentQuestion.options as { key: string; value: string }[]).every(
            (o) => !!draft.clozeAnswers[o.key]
          )
        );
      default:
        return false;
    }
  }, [currentQuestion, draft]);

  // 快捷键：←/→ 切题、1-9/A-J 选选项、Enter 提交/下一题、F 标记、C 收藏
  // 优先级：未提交的选项类题目，按键命中选项（含 C/F 键）时优先选择选项；
  // 否则 F/C 生效为标记/收藏快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (loading || showSummary || modePreparing || reportOpen || confirmSummaryOpen) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToQuestion(currentIndex - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToQuestion(currentIndex + 1);
        return;
      }
      if (e.key === "Enter") {
        if (e.repeat) return;
        e.preventDefault();
        if (draftRef.current.submitted) {
          handleNext();
        } else if (canSubmit) {
          checkAnswer();
        }
        return;
      }

      // 数字/字母选择选项（仅未提交且为选项类题型，且命中实际存在的选项）
      const isOptionType =
        !!currentQuestion &&
        !draftRef.current.submitted &&
        (currentQuestion.type === "single" || currentQuestion.type === "multiple");
      const matchedKey = isOptionType && currentQuestion
        ? optionKeyFromEvent(e, currentQuestion.options)
        : null;

      if (matchedKey && currentQuestion) {
        e.preventDefault();
        if (currentQuestion.type === "single") {
          updateDraft({ selectedOption: matchedKey });
        } else {
          const prev = draftRef.current.selectedOptions;
          updateDraft({
            selectedOptions: prev.includes(matchedKey)
              ? prev.filter((k) => k !== matchedKey)
              : [...prev, matchedKey],
          });
        }
        return;
      }

      if (e.key === "f" || e.key === "F") {
        if (currentQuestion) {
          e.preventDefault();
          toggleMarked(currentQuestion.id);
        }
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        void handleToggleFavorite();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loading, showSummary, modePreparing, reportOpen, confirmSummaryOpen, currentIndex, currentQuestion, canSubmit, goToQuestion, handleNext, checkAnswer, toggleMarked, handleToggleFavorite, updateDraft]);

  // 题目数超出窗口时，让侧栏窗口跟随当前题滚动（窗口按页对齐）
  useEffect(() => {
    if (displayOrder.length <= SIDEBAR_WINDOW) return;
    if (
      currentIndex < sidebarStart ||
      currentIndex >= sidebarStart + SIDEBAR_WINDOW
    ) {
      const aligned = Math.floor(currentIndex / SIDEBAR_WINDOW) * SIDEBAR_WINDOW;
      setSidebarStart(Math.min(aligned, displayOrder.length - SIDEBAR_WINDOW));
    }
  }, [currentIndex, displayOrder.length, sidebarStart]);

  // 侧栏窗口变化时补拉缺失的题目详情
  useEffect(() => {
    fillWindow(sidebarStart);
  }, [sidebarStart, fillWindow]);

  // 当前展示位变化（含随机打乱后）时，确保当前题与相邻题可用
  useEffect(() => {
    ensureAt(currentIndex);
  }, [currentIndex, ensureAt]);

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
          importance: noteImportance,
        }),
      });
      if (res.ok) {
        setNoteMsg("笔记已保存");
        setHasExistingNote(true);
      } else {
        setNoteMsg("保存失败");
      }
    } catch {
      setNoteMsg("网络错误");
    } finally {
      setNoteSaving(false);
    }
  };

  /** 复制 AI 内容为纯文本（经消毒后用临时 DOM 取 textContent） */
  const handleCopyAi = async () => {
    if (!aiResult) return;
    try {
      const holder = document.createElement("div");
      holder.innerHTML = sanitizeAiHtml(aiResult);
      await navigator.clipboard.writeText(holder.textContent || "");
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
  };

  /** 停止当前 AI 流式请求，已接收的部分内容保留显示 */
  const handleStopAi = () => {
    aiAbortRef.current?.abort();
  };

  /** AI 解析/讲解/相似题：流式请求，delta 增量实时渲染，done 后按题入缓存 */
  const handleAiAction = async (action: AiAction, skipCache = false) => {
    if (!currentQuestion || aiLoading) return;
    const token = localStorage.getItem("novamind_token");
    if (!token) return;
    const questionId = currentQuestion.id;
    const key = aiCacheKey(questionId, action);
    aiLastActionRef.current.set(questionId, action);

    // 管理员未开启 AI：不再发请求，仅展示占位，避免报错刷屏
    if (aiDisabled) {
      setAiAction(action);
      setAiResult("");
      setAiError("");
      return;
    }

    // 会话内已生成过：直接回显缓存（"重新生成"跳过缓存重新请求）
    if (!skipCache) {
      const cached = aiCacheRef.current.get(key);
      if (cached !== undefined) {
        setAiAction(action);
        setAiResult(cached);
        setAiError("");
        return;
      }
    }

    setAiAction(action);
    setAiResult("");
    setAiError("");
    setAiLoading(true);
    const controller = new AbortController();
    aiAbortRef.current = controller;
    let received = "";
    /** error 事件 / HTTP 错误统一处理：AI 未启用转占位，其余 toast 提示并保留已收内容 */
    const applyError = (message: string) => {
      if (message.includes("未启用")) {
        setAiDisabled(true);
        setAiError("");
        return;
      }
      setAiError(message);
      toast.error(message);
    };
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionId, action, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let message = "AI 请求失败";
        try {
          const data = await res.json();
          if (data && typeof data.error === "string") message = data.error;
        } catch {
          // ignore
        }
        applyError(message);
        return;
      }

      // 解析 SSE 流：按空行分隔事件，delta 增量实时追加（打字机效果）
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (raw: string): string => {
        const events = raw.split("\n\n");
        const pending = events.pop() ?? "";
        for (const block of events) {
          const parsed = parseSseEvent(block);
          if (!parsed) continue;
          if (parsed.event === "delta") {
            const delta = typeof parsed.data.delta === "string" ? parsed.data.delta : "";
            received += delta;
            setAiResult(received);
          } else if (parsed.event === "done") {
            const usage = parseAiUsage(parsed.data.usage);
            if (usage) setAiUsage(usage);
          } else if (parsed.event === "error") {
            applyError(typeof parsed.data.error === "string" ? parsed.data.error : "AI 生成失败");
          }
        }
        return pending;
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = consume(buffer + decoder.decode(value, { stream: true }));
      }
      consume(buffer + decoder.decode());
    } catch (err) {
      // 主动停止：保留已收到的部分内容且不提示错误；内容为空时收起面板
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort) {
        if (!received) setAiAction(null);
      } else {
        applyError("网络错误，请稍后重试");
      }
    } finally {
      if (received) aiCacheRef.current.set(key, received);
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
      setAiLoading(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim() || reportReason.trim().length < 5) {
      toast.error("反馈原因至少需要5个字符");
      return;
    }
    setReporting(true);
    try {
      const token = localStorage.getItem("novamind_token");
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionBankId: bankId,
          questionId: currentQuestion?.id || null,
          reason: reportReason.trim(),
        }),
      });
      if (res.ok) {
        toast.success("反馈已提交，管理员会尽快处理");
        setReportOpen(false);
        setReportReason("");
      } else {
        const data = await res.json();
        toast.error(data.error || "提交失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setReporting(false);
    }
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

  if (idList.length === 0) {
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
    const wrongCount = allResults.length - correctCount;
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
                <p className="text-3xl font-bold text-red-600">{wrongCount}</p>
                <p className="text-sm text-muted-foreground">错误</p>
              </div>
            </div>
            <Progress value={accuracy} className="h-3" />
            <p className="text-center text-lg font-semibold">
              正确率：{accuracy}%
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={restartPractice}>重新练习</Button>
              <Button variant="outline" onClick={retryWrongOnly} disabled={wrongCount === 0}>
                只重练本次错题
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
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", sidebarView === "list" && "text-primary")}
              title="列表视图"
              onClick={() => setSidebarView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", sidebarView === "grid" && "text-primary")}
              title="答题卡视图"
              onClick={() => setSidebarView("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {displayOrder.length > SIDEBAR_WINDOW && (
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
            <Button
              variant="outline" size="sm" className="h-6 px-2 text-xs"
              disabled={sidebarStart === 0}
              onClick={() => setSidebarStart(Math.max(0, sidebarStart - SIDEBAR_WINDOW))}
            >
              前一页
            </Button>
            <span>
              第 {sidebarStart + 1}-{Math.min(sidebarStart + SIDEBAR_WINDOW, displayOrder.length)} 题 / 共 {displayOrder.length} 题
            </span>
            <Button
              variant="outline" size="sm" className="h-6 px-2 text-xs"
              disabled={sidebarStart + SIDEBAR_WINDOW >= displayOrder.length}
              onClick={() => setSidebarStart(Math.min(displayOrder.length - SIDEBAR_WINDOW, sidebarStart + SIDEBAR_WINDOW))}
            >
              后一页
            </Button>
          </div>
        )}
        <div className="max-h-[calc(100vh-10rem)] overflow-auto p-2">
          {sidebarView === "grid" ? (
            /* 答题卡：网格视图，绿=答对 红=答错 琥珀描边=已标记 灰=未答 */
            <div className="grid grid-cols-5 gap-1.5 p-1">
              {displayOrder.slice(sidebarStart, sidebarStart + SIDEBAR_WINDOW).map((bankIdx, windowIdx) => {
                const i = sidebarStart + windowIdx;
                const qid = idList[bankIdx];
                const qResult = qid ? resultByQuestionId.get(qid) : undefined;
                const isMarked = qid ? marked.has(qid) : false;
                const q = details.get(qid ?? "");
                return (
                  <button
                    key={`grid-${qid ?? i}`}
                    title={q?.content || `第 ${i + 1} 题`}
                    onClick={() => { goToQuestion(i); setSidebarOpen(false); }}
                    className={cn(
                      "flex h-8 w-full items-center justify-center rounded-md border text-xs font-medium transition-colors",
                      qResult
                        ? qResult.isCorrect
                          ? "border-green-500 bg-green-100 text-green-700 dark:bg-green-950"
                          : "border-red-500 bg-red-100 text-red-700 dark:bg-red-950"
                        : "border-border bg-muted text-muted-foreground",
                      isMarked && "border-2 border-amber-500",
                      i === currentIndex && "ring-2 ring-primary ring-offset-1"
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          ) : (
            displayOrder.slice(sidebarStart, sidebarStart + SIDEBAR_WINDOW).map((bankIdx, windowIdx) => {
              const i = sidebarStart + windowIdx;
              const q = details.get(idList[bankIdx] ?? "");
              const qid = idList[bankIdx];
              const qResult = qid ? resultByQuestionId.get(qid) : undefined;
              // 详情尚未加载到时渲染占位，点击后自动触发加载
              if (!q) {
                return (
                  <button
                    key={`placeholder-${idList[bankIdx] ?? i}`}
                    onClick={() => { goToQuestion(i); setSidebarOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground/60 transition-colors hover:bg-accent"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                      {i + 1}
                    </span>
                    <span className="truncate">加载中...</span>
                  </button>
                );
              }
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
                  {marked.has(q.id) && (
                    <Flag className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-500" />
                  )}
                  {qResult && (
                    qResult.isCorrect ? (
                      <CheckCircle2 className={cn("h-4 w-4 shrink-0 text-green-500", marked.has(q.id) && "ml-1")} />
                    ) : (
                      <XCircle className={cn("h-4 w-4 shrink-0 text-red-500", marked.has(q.id) && "ml-1")} />
                    )
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl font-bold">{bankTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {answeredCount}/{displayOrder.length} 已答
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-orange-600"
              onClick={() => setReportOpen(true)}
              title="反馈题目"
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <List className="mr-1 h-4 w-4" />
            列表
          </Button>
        </div>

        <Progress value={progress} className="h-2" />

        {/* Mode tabs */}
        <Tabs value={mode} onValueChange={(v) => void handleModeChange(v)}>
          <TabsList>
            <TabsTrigger value="sequential">顺序</TabsTrigger>
            <TabsTrigger
              value="random"
              onClick={() => {
                if (mode === "random") reshuffleRandom();
              }}
            >
              <Shuffle className="mr-1 h-3 w-3" />
              随机
            </TabsTrigger>
            <TabsTrigger value="wrong">错题重练</TabsTrigger>
            <TabsTrigger value="review">
              <RefreshCcw className="mr-1 h-3 w-3" />
              复习
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Question card */}
        {modePreparing ? (
          <Card>
            <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              正在准备题目...
            </CardContent>
          </Card>
        ) : displayOrder.length === 0 ? (
          mode === "review" ? (
            <Card>
              <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <RefreshCcw className="h-8 w-8 text-muted-foreground/40" />
                今日无到期复习
                <p className="max-w-sm text-center text-xs">
                  错题将按遗忘曲线在第 1/2/4/7/15/30 天到期，答对后即视为掌握
                </p>
              </CardContent>
            </Card>
          ) : mode === "wrong" ? (
            <Card>
              <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-green-500/60" />
                {wrongLoaded ? "该题库暂无错题记录，继续保持！" : "暂无错题记录"}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                暂无可练习的题目
              </CardContent>
            </Card>
          )
        ) : !currentQuestion ? (
          <Card>
            <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              题目加载中...
            </CardContent>
          </Card>
        ) : (
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
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title={marked.has(currentQuestion.id) ? "取消标记" : "标记待复查"}
                  onClick={() => toggleMarked(currentQuestion.id)}
                >
                  <Flag className={cn("h-5 w-5", marked.has(currentQuestion.id) ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={favToggling}
                  title={favored ? "取消收藏" : "收藏本题"}
                  onClick={handleToggleFavorite}
                >
                  <Heart className={cn("h-5 w-5", favored ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                </Button>
              </div>
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
              <RadioGroup value={draft.selectedOption} onValueChange={(v) => updateDraft({ selectedOption: v })} disabled={draft.submitted} className="space-y-2">
                {currentQuestion.options?.map((opt) => (
                  <label
                    key={opt.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50",
                      draft.submitted && opt.key === currentQuestion.answer && "border-green-500 bg-green-50",
                      draft.submitted && draft.selectedOption === opt.key && opt.key !== currentQuestion.answer && "border-red-500 bg-red-50",
                      draft.submitted && draft.selectedOption === opt.key && opt.key === currentQuestion.answer && "border-green-500 bg-green-50"
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
                      draft.submitted && currentQuestion.answer.includes(opt.key) && "border-green-500 bg-green-50",
                      draft.submitted && draft.selectedOptions.includes(opt.key) && !currentQuestion.answer.includes(opt.key) && "border-red-500 bg-red-50"
                    )}
                  >
                    <Checkbox
                      checked={draft.selectedOptions.includes(opt.key)}
                      disabled={draft.submitted}
                      onCheckedChange={(checked) => {
                        updateDraft({
                          selectedOptions: checked
                            ? [...draft.selectedOptions, opt.key]
                            : draft.selectedOptions.filter((k) => k !== opt.key),
                        });
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
                    variant={draft.truefalseAnswer === val ? "default" : "outline"}
                    className={cn(
                      "flex-1 py-8 text-lg",
                      draft.submitted && val === currentQuestion.answer && "bg-green-500 hover:bg-green-500",
                      draft.submitted && draft.truefalseAnswer === val && val !== currentQuestion.answer && "bg-red-500 hover:bg-red-500"
                    )}
                    disabled={draft.submitted}
                    onClick={() => updateDraft({ truefalseAnswer: val })}
                  >
                    {val === "true" ? "正确" : "错误"}
                  </Button>
                ))}
              </div>
            )}

            {currentQuestion.type === "fillblank" && (
              <div className="space-y-2">
                <Input
                  value={draft.fillAnswer}
                  onChange={(e) => updateDraft({ fillAnswer: e.target.value })}
                  disabled={draft.submitted}
                  placeholder="请输入答案..."
                  className={cn(
                    draft.submitted && draft.result?.isCorrect && "border-green-500 bg-green-50",
                    draft.submitted && !draft.result?.isCorrect && "border-red-500 bg-red-50"
                  )}
                />
                {draft.submitted && currentQuestion.answer && (
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
                        const selectedKey = draft.clozeAnswers[blankNum] || "";
                        const isCorrectBlank = draft.submitted && selectedKey === (currentQuestion.answer.split(",").map((s) => s.trim())[blanks.findIndex((b) => b.key === blankNum)] || "");
                        return (
                          <span key={i} className="inline-block mx-1">
                            <select
                              value={selectedKey}
                              onChange={(e) => updateDraft({ clozeAnswers: { ...draft.clozeAnswers, [blankNum]: e.target.value } })}
                              disabled={draft.submitted}
                              className={cn(
                                "rounded border px-2 py-1 text-sm",
                                !draft.submitted && "bg-background",
                                draft.submitted && isCorrectBlank && "border-green-500 bg-green-100",
                                draft.submitted && !isCorrectBlank && "border-red-500 bg-red-100"
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
                {draft.submitted && currentQuestion.answer && (
                  <p className="text-sm text-muted-foreground">
                    正确答案：{currentQuestion.answer}
                  </p>
                )}
              </div>
            )}

            {/* Result */}
            {draft.submitted && draft.result && (
              <div className={cn(
                "rounded-md border p-4",
                draft.result.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
              )}>
                <div className="flex items-center gap-2">
                  {draft.result.isCorrect ? (
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
                  {draft.result.synced === false && (
                    <Badge variant="outline" className="border-amber-400 text-amber-600">
                      未同步
                    </Badge>
                  )}
                </div>
                {draft.result.analysis && (
                  <div className="mt-3 rounded-md bg-white p-3">
                    <p className="text-sm font-medium">解析：</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{draft.result.analysis}</p>
                  </div>
                )}
              </div>
            )}

            {/* AI result */}
            {(aiDisabled || aiAction !== null) && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                      {aiAction ? AI_ACTION_LABELS[aiAction] : "AI 助手"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {aiUsage && (
                      <span className="mr-1 text-xs text-muted-foreground">
                        今日剩余 {Math.max(0, aiUsage.limit - aiUsage.used)}/{aiUsage.limit} 次
                      </span>
                    )}
                    {aiLoading ? (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleStopAi}>
                        <Square className="mr-1 h-3 w-3" />
                        停止
                      </Button>
                    ) : (
                      aiResult && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopyAi}>
                            <Copy className="mr-1 h-3 w-3" />
                            复制
                          </Button>
                          {aiAction && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleAiAction(aiAction, true)}
                            >
                              <RefreshCcw className="mr-1 h-3 w-3" />
                              重新生成
                            </Button>
                          )}
                        </>
                      )
                    )}
                  </div>
                </div>
                {aiDisabled ? (
                  <p className="text-sm text-muted-foreground">管理员未开启 AI 功能</p>
                ) : aiLoading && !aiResult ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : aiResult ? (
                  <div
                    className="ai-content text-sm"
                    dangerouslySetInnerHTML={{ __html: sanitizeAiHtml(aiResult) }}
                  />
                ) : null}
                {aiError && <p className="mt-2 text-sm text-red-600">{aiError}</p>}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Action buttons */}
        {currentQuestion && (
          <div className="flex flex-wrap items-center gap-2">
            {!draft.submitted ? (
              <Button onClick={checkAnswer} disabled={!canSubmit}>
                <Send className="mr-2 h-4 w-4" />
                提交答案
              </Button>
            ) : (
              <Button onClick={handleNext}>
                {currentIndex < displayOrder.length - 1 ? (
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
            <Button
              variant={hasExistingNote ? "default" : "outline"}
              size="sm"
              onClick={() => setNotePanelOpen(!notePanelOpen)}
            >
              <StickyNote className="mr-1 h-4 w-4" />
              {notePanelOpen ? "隐藏笔记" : hasExistingNote ? "查看笔记" : "添加笔记"}
            </Button>
          </div>
        )}

        {notePanelOpen && currentQuestion && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="note" className="text-base font-medium">
                  {hasExistingNote ? "编辑笔记" : "添加笔记"}
                </Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={cn(
                        "h-5 w-5 transition-colors",
                        star <= noteImportance
                          ? "text-yellow-500"
                          : "text-muted-foreground/30"
                      )}
                      onClick={() => setNoteImportance(star === noteImportance ? 0 : star)}
                    >
                      <Star
                        className="h-5 w-5"
                        fill={star <= noteImportance ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                id="note"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="为这道题添加笔记..."
                rows={4}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveNote} disabled={noteSaving || !noteContent.trim()}>
                  {noteSaving ? "保存中..." : "保存笔记"}
                </Button>
                {noteMsg && (
                  <span className={cn(
                    "text-xs",
                    noteMsg === "笔记已保存" ? "text-green-600" : "text-red-600"
                  )}>
                    {noteMsg}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => goToQuestion(currentIndex - 1)}
            disabled={currentIndex <= 0 || modePreparing || displayOrder.length === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一题
          </Button>
          <span className="text-sm text-muted-foreground">
            {displayOrder.length > 0 ? `${currentIndex + 1} / ${displayOrder.length}` : "- / -"}
          </span>
          <Button
            variant="outline"
            onClick={() => goToQuestion(currentIndex + 1)}
            disabled={currentIndex >= displayOrder.length - 1 || modePreparing || displayOrder.length === 0}
          >
            下一题
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* 快捷键说明 */}
        <p className="text-center text-xs text-muted-foreground">
          快捷键：← / → 切换题目 · 数字 1-9 或字母 A-J 选择选项 · Enter 提交 / 下一题 · F 标记待复查 · C 收藏
        </p>
      </div>

      {/* 未答完确认 */}
      <AlertDialog open={confirmSummaryOpen} onOpenChange={setConfirmSummaryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>还有未完成的题目</AlertDialogTitle>
            <AlertDialogDescription>
              本次练习还有 {pendingUnanswered} 题未作答，确定要现在查看总结吗？未作答的题目不计入成绩。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续答题</AlertDialogCancel>
            <AlertDialogAction onClick={openSummary}>查看总结</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>反馈题目</DialogTitle>
            <DialogDescription>
              请描述题目或题库存在的问题
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {currentQuestion && (
              <div className="rounded border p-3 text-sm bg-muted/30">
                <p className="font-medium">当前题目：</p>
                <p className="mt-1 text-muted-foreground">{currentQuestion.content}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>反馈原因</Label>
              <Textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="请详细描述问题，例如：答案错误、选项不合理、题目有歧义等..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReportOpen(false); setReportReason(""); }}>
              取消
            </Button>
            <Button onClick={handleSubmitReport} disabled={reporting || reportReason.trim().length < 5}>
              {reporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                "提交反馈"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function QuestionPracticePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <PracticeContent />
    </Suspense>
  );
}
