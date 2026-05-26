import { create } from "zustand";

interface ExamQuestion {
  id: string;
  questionId: string;
  sortOrder: number;
  userAnswer: string | null;
  isCorrect: boolean | null;
  question: {
    id: string;
    type: string;
    content: string;
    options: { key: string; value: string }[];
    answer?: string;
    analysis?: string | null;
    image?: string | null;
  };
}

interface ExamData {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  difficulty: number;
  difficultyLabel: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  settings: any;
  createdAt: string;
  updatedAt: string;
  questions: ExamQuestion[];
}

interface ExamState {
  exam: ExamData | null;
  currentIndex: number;
  answers: Record<string, string>;
  timeRemaining: number | null;
  timerInterval: ReturnType<typeof setInterval> | null;

  setExam: (exam: ExamData) => void;
  setCurrentIndex: (index: number) => void;
  setAnswer: (questionId: string, answer: string) => void;
  setTimeRemaining: (seconds: number) => void;
  startTimer: (durationMinutes: number) => void;
  stopTimer: () => void;
  tickTimer: () => void;
  resetExam: () => void;
}

export const useExamStore = create<ExamState>((set, get) => ({
  exam: null,
  currentIndex: 0,
  answers: {},
  timeRemaining: null,
  timerInterval: null,

  setExam: (exam) => {
    const answers: Record<string, string> = {};
    exam.questions.forEach((eq) => {
      if (eq.userAnswer) {
        answers[eq.questionId] = eq.userAnswer;
      }
    });

    set({
      exam,
      currentIndex: 0,
      answers,
      timeRemaining: null,
    });
  },

  setCurrentIndex: (index) => {
    const { exam } = get();
    if (exam && index >= 0 && index < exam.questions.length) {
      set({ currentIndex: index });
    }
  },

  setAnswer: (questionId, answer) => {
    const { answers } = get();
    set({ answers: { ...answers, [questionId]: answer } });
  },

  setTimeRemaining: (seconds) => {
    set({ timeRemaining: seconds });
  },

  startTimer: (durationMinutes) => {
    const { timerInterval } = get();
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    const totalSeconds = durationMinutes * 60;
    set({ timeRemaining: totalSeconds });

    const interval = setInterval(() => {
      const { timeRemaining } = get();
      if (timeRemaining !== null && timeRemaining > 0) {
        set({ timeRemaining: timeRemaining - 1 });
      } else {
        const ti = get().timerInterval;
        if (ti) clearInterval(ti);
        set({ timerInterval: null });
      }
    }, 1000);

    set({ timerInterval: interval });
  },

  stopTimer: () => {
    const { timerInterval } = get();
    if (timerInterval) {
      clearInterval(timerInterval);
      set({ timerInterval: null });
    }
  },

  tickTimer: () => {
    const { timeRemaining } = get();
    if (timeRemaining !== null && timeRemaining > 0) {
      set({ timeRemaining: timeRemaining - 1 });
    }
  },

  resetExam: () => {
    const { timerInterval } = get();
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    set({
      exam: null,
      currentIndex: 0,
      answers: {},
      timeRemaining: null,
      timerInterval: null,
    });
  },
}));
