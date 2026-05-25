export interface User {
  id: string;
  email: string;
  username?: string | null;
  name: string;
  avatar?: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  isActivated: boolean;
  emailVerified: boolean;
  activatedAt?: string | null;
  banned: boolean;
  bannedReason?: string | null;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  todayUsedSeconds: number;
  lastUsedDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionOption {
  key: string;
  value: string;
}

export interface Question {
  id: string;
  bankId: string;
  type: "single" | "multiple" | "truefalse" | "fillblank" | "cloze";
  content: string;
  options: QuestionOption[];
  answer: string;
  analysis?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // 客户端状态
  userAnswer?: string;
  isCorrect?: boolean;
  showAnalysis?: boolean;
  isFavorite?: boolean;
  note?: string;
}

export interface QuestionBank {
  id: string;
  title: string;
  description?: string | null;
  source: string;
  category: string;
  tags: string[];
  difficulty: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isPublic: boolean;
  uploaderId: string;
  uploader?: { name: string; email: string };
  reviewComment?: string | null;
  reviewedAt?: string | null;
  _count?: { questions: number };
  createdAt: string;
  updatedAt: string;
}

export interface ActivationCode {
  id: string;
  code: string;
  prefix: string;
  batchId: string;
  duration: number;
  isUsed: boolean;
  usedById?: string | null;
  usedBy?: { name: string; email: string } | null;
  usedAt?: string | null;
  expiresAt?: string | null;
  status: "UNUSED" | "USED" | "EXPIRED";
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  user?: { name: string; email: string } | null;
  action: string;
  details?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

export interface PracticeRecord {
  id: string;
  userId: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  duration: number;
  sessionId?: string | null;
  question?: Question;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type PracticeMode = "sequential" | "random" | "wrong";
export type QuestionType = "single" | "multiple" | "truefalse" | "fillblank" | "cloze";
