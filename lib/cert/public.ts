// 클라이언트로 내려보내도 되는 타입·상수 (정답·해설 없음). 서버·클라이언트 공용.
import type { AnswerMode, CertQuestion, Subject } from "./types";
import type { BlankResult } from "./grade";

// 서술형 판정. pending = 키워드가 없어 자기 채점을 기다리는 상태
export type Verdict = "full" | "partial" | "wrong" | "pending";

export interface PublicBlank {
  label: string | null;
  set?: boolean;
  seq?: boolean;
}

export interface PublicQuestion extends Omit<CertQuestion, "answer" | "explanation"> {
  source: string; // '2020년 1회 · 7번'
  kind: "exam" | "workbook";
  answer: { mode: AnswerMode; ordered: boolean; note?: string; blanks: PublicBlank[] };
}

export interface QResult {
  id: string;
  mode: AnswerMode;
  correct: boolean | null;
  score: number;
  maxScore: number;
  blanks: BlankResult[];
  keywordHits?: { keyword: string; hit: boolean }[];
  verdict?: Verdict;
  inputs: string[];
  answer: string; // answer.display
  explanation: string;
}

export interface SubjectScore {
  subject: Subject;
  n: number;
  got: number;
  max: number;
}

export interface SessionSummary {
  sessionId: string;
  got: number;
  max: number;
  score100: number;
  pass: boolean;
  pending: number; // 자기 채점을 기다리는 서술형 수
  bySubject: SubjectScore[];
}

export const EXAM_MINUTES = 150;

// 무한 풀기에서 빼는 기출 연도
export const ENDLESS_EXCLUDED_YEARS = [2025, 2026];

export const MODE_LABELS: Record<AnswerMode, string> = {
  short: "단답형",
  output: "실행 결과",
  essay: "서술형",
};

// 기존 3색 재사용: short = 빈칸/단답형(mustard), output = teal, essay = indigo
export const MODE_STYLES: Record<AnswerMode, { badge: string; tab: string }> = {
  short: { badge: "bg-amber/10 text-amber border-amber/30", tab: "#C08A22" },
  output: { badge: "bg-teal/10 text-teal border-teal/30", tab: "#0F7A72" },
  essay: { badge: "bg-brand/10 text-brand border-brand/30", tab: "#4338CA" },
};

export const LANGS = ["C", "Java", "Python"] as const;

export function emptyInputs(q: PublicQuestion): string[] {
  return new Array(q.answer.mode === "short" ? Math.max(q.answer.blanks.length, 1) : 1).fill("");
}

export function isAnswered(inputs: string[] | undefined): boolean {
  return !!inputs && inputs.some((s) => s.trim() !== "");
}
