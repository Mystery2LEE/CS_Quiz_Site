// grade.ts 위에 얹는 서버용 채점 래퍼: 서술형 키워드 판정, 세션 점수 집계
import { grade, passResult, type GradeResult } from "./grade";
import type { CertQuestion, Subject } from "./types";
import type { QResult, SessionSummary, SubjectScore, Verdict } from "./public";

export interface SessionItem {
  id: string;
  subject: Subject;
  score: number;
  maxScore: number;
  correct: boolean | null;
  verdict?: Verdict;
}

/** 서술형 점수: full = 배점, partial = 배점의 절반, wrong/pending = 0 */
export function verdictScore(points: number, verdict: Verdict): number {
  if (verdict === "full") return points;
  if (verdict === "partial") return Math.round(points * 5) / 10;
  return 0;
}

/**
 * grade() + 서술형 키워드 판정.
 * 서술형은 필수 표현(keywords)이 전부 들어 있으면 full, 일부면 partial, 없으면 wrong.
 * keywords가 없는 문항은 pending(자기 채점 대기)으로 둔다.
 */
export function judge(q: CertQuestion, inputs: string[]): QResult {
  const r = grade(q, inputs);
  const base = { id: q.id, inputs, answer: q.answer.display, explanation: q.explanation };
  if (r.mode !== "essay") return { ...r, ...base };

  const hits = r.keywordHits ?? [];
  const hitCount = hits.filter((h) => h.hit).length;
  let verdict: Verdict;
  if (!(inputs[0] ?? "").trim()) verdict = "wrong";
  else if (hits.length === 0) verdict = "pending";
  else verdict = hitCount === hits.length ? "full" : hitCount > 0 ? "partial" : "wrong";

  return {
    ...r,
    ...base,
    verdict,
    correct: verdict === "pending" ? null : verdict === "full",
    score: verdictScore(q.points, verdict),
  };
}

export function toItem(q: CertQuestion, r: QResult): SessionItem {
  return {
    id: q.id,
    subject: q.subject,
    score: r.score,
    maxScore: r.maxScore,
    correct: r.correct,
    ...(r.verdict ? { verdict: r.verdict } : {}),
  };
}

export function summarize(sessionId: string, items: SessionItem[]): SessionSummary {
  const { got, max, score100, pass } = passResult(items as unknown as GradeResult[]);
  const map = new Map<Subject, SubjectScore>();
  for (const it of items) {
    const s = map.get(it.subject) ?? { subject: it.subject, n: 0, got: 0, max: 0 };
    s.n += 1;
    s.got += it.score;
    s.max += it.maxScore;
    map.set(it.subject, s);
  }
  return {
    sessionId,
    got,
    max,
    score100,
    pass,
    pending: items.filter((it) => it.verdict === "pending").length,
    bySubject: [...map.values()],
  };
}
