// 문제 데이터 조회 헬퍼 — 서버 전용 (questions.json 약 1.1MB, 클라이언트 번들에 넣지 말 것)
import "server-only";
import questionsJson from "@/data/cert/questions.json";
import setsJson from "@/data/cert/sets.json";
import type { CertQuestion, CertSet, CertSetsFile, Subject } from "./types";
import type { PublicQuestion } from "./public";

const QUESTIONS = questionsJson as unknown as CertQuestion[];
const SETS_FILE = setsJson as unknown as CertSetsFile;

export const SUBJECTS: Subject[] = SETS_FILE.subjects;
export const SETS: CertSet[] = SETS_FILE.sets;

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
const SET_BY_ID = new Map(SETS.map((s) => [s.id, s]));

export function allQuestions(): CertQuestion[] {
  return QUESTIONS;
}

export function getSet(setId: string): CertSet | undefined {
  return SET_BY_ID.get(setId);
}

export function getQuestion(id: string): CertQuestion | undefined {
  return BY_ID.get(id);
}

export function bySet(setId: string): CertQuestion[] {
  return QUESTIONS.filter((q) => q.setId === setId).sort((a, b) => a.number - b.number);
}

export function bySubject(subject: Subject): CertQuestion[] {
  return QUESTIONS.filter((q) => q.subject === subject);
}

export function isSubject(s: string): s is Subject {
  return (SUBJECTS as string[]).includes(s);
}

export function kindOf(q: CertQuestion): "exam" | "workbook" {
  return getSet(q.setId)?.kind ?? "workbook";
}

/** '2020년 1회 · 7번' / '키워드찾기 130제 · 7번' */
export function sourceLabel(q: CertQuestion): string {
  const set = getSet(q.setId);
  const title = !set
    ? q.setId
    : set.kind === "exam"
    ? set.title.replace(" 정보처리기사 실기", "")
    : set.title;
  return `${title} · ${q.number}번`;
}

const fold = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** prompt·body·answer.display·explanation 전문 검색 (대소문자·연속 공백 무시) */
export function search(query: string, limit = 100): CertQuestion[] {
  const needle = fold(query);
  if (!needle) return [];
  const out: CertQuestion[] = [];
  for (const q of QUESTIONS) {
    const hay = fold(`${q.prompt}\n${q.body}\n${q.answer.display}\n${q.explanation}`);
    if (hay.includes(needle)) {
      out.push(q);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** 풀이 화면용: 정답·해설을 빼고 빈칸 개수·label·ordered·note·mode만 남긴다 */
export function stripAnswer(q: CertQuestion): PublicQuestion {
  const { answer, explanation: _explanation, ...rest } = q;
  return {
    ...rest,
    body: q.image ? "" : q.body, // 이미지가 있으면 body는 화면에 쓰지 않는다
    source: sourceLabel(q),
    kind: kindOf(q),
    answer: {
      mode: answer.mode,
      ordered: answer.ordered,
      ...(answer.note ? { note: answer.note } : {}),
      blanks: answer.blanks.map((b) => ({
        label: b.label,
        ...(b.set ? { set: true } : {}),
        ...(b.seq ? { seq: true } : {}),
      })),
    },
  };
}
