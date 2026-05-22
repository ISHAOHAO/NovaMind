import { create } from "zustand";
import { Question, PracticeMode } from "@/types";

interface PracticeState {
  mode: PracticeMode;
  questions: Question[];
  currentIndex: number;
  answers: Map<string, string>;
  results: Map<string, boolean>;
  sessionId: string | null;
  startTime: number | null;
  isCompleted: boolean;

  setMode: (mode: PracticeMode) => void;
  setQuestions: (questions: Question[]) => void;
  setCurrentIndex: (index: number) => void;
  answerQuestion: (questionId: string, answer: string, isCorrect: boolean) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  startSession: (sessionId: string) => void;
  resetSession: () => void;
  markCompleted: () => void;
  getCorrectCount: () => number;
  getWrongQuestions: () => Question[];
  getProgress: () => number;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  mode: "sequential",
  questions: [],
  currentIndex: 0,
  answers: new Map(),
  results: new Map(),
  sessionId: null,
  startTime: null,
  isCompleted: false,

  setMode: (mode) => set({ mode }),

  setQuestions: (questions) =>
    set({
      questions,
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      isCompleted: false,
    }),

  setCurrentIndex: (index) => {
    const { questions } = get();
    if (index >= 0 && index < questions.length) {
      set({ currentIndex: index });
    }
  },

  answerQuestion: (questionId, answer, isCorrect) => {
    const { answers, results } = get();
    const newAnswers = new Map(answers);
    const newResults = new Map(results);
    newAnswers.set(questionId, answer);
    newResults.set(questionId, isCorrect);
    set({ answers: newAnswers, results: newResults });
  },

  nextQuestion: () => {
    const { currentIndex, questions } = get();
    if (currentIndex < questions.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  prevQuestion: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  startSession: (sessionId) =>
    set({
      sessionId,
      startTime: Date.now(),
      answers: new Map(),
      results: new Map(),
      currentIndex: 0,
      isCompleted: false,
    }),

  resetSession: () =>
    set({
      questions: [],
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      sessionId: null,
      startTime: null,
      isCompleted: false,
    }),

  markCompleted: () => set({ isCompleted: true }),

  getCorrectCount: () => {
    const { results } = get();
    let count = 0;
    results.forEach((isCorrect) => {
      if (isCorrect) count++;
    });
    return count;
  },

  getWrongQuestions: () => {
    const { questions, results } = get();
    return questions.filter((q) => results.get(q.id) === false);
  },

  getProgress: () => {
    const { questions, answers } = get();
    if (questions.length === 0) return 0;
    return answers.size / questions.length;
  },
}));
