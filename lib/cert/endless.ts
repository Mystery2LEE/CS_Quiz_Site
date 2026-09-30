// 무한 풀기 출제 (서버 전용)
import { allQuestions, getSet, isSubject, shuffled } from "./data";
import { ENDLESS_EXCLUDED_YEARS } from "./public";
import type { CertQuestion, Subject } from "./types";

export interface EndlessFilter {
  source: "all" | "exam" | "workbook";
  subject: Subject | null;
}

export function normalizeEndlessFilter(raw: any): EndlessFilter {
  return {
    source: raw?.source === "exam" || raw?.source === "workbook" ? raw.source : "all",
    subject: typeof raw?.subject === "string" && isSubject(raw.subject) ? raw.subject : null,
  };
}

/** 출제 범위: ENDLESS_EXCLUDED_YEARS 회차의 기출을 뺀 나머지 */
export function endlessPool(f: EndlessFilter): CertQuestion[] {
  return allQuestions().filter((q) => {
    const set = getSet(q.setId);
    const kind = set?.kind ?? "workbook";
    if (kind === "exam" && set?.year != null && ENDLESS_EXCLUDED_YEARS.includes(set.year)) return false;
    return (f.source === "all" || kind === f.source) && (!f.subject || q.subject === f.subject);
  });
}

/** 아직 안 나온 문제에서 무작위로 n개. 다 나왔으면 범위 전체에서 다시 뽑는다(cycled). */
export function pickEndless(
  f: EndlessFilter,
  exclude: Set<string>,
  n: number
): { questions: CertQuestion[]; cycled: boolean; poolSize: number } {
  const pool = endlessPool(f);
  const fresh = pool.filter((q) => !exclude.has(q.id));
  const cycled = fresh.length === 0 && pool.length > 0;
  return {
    questions: shuffled(cycled ? pool : fresh).slice(0, n),
    cycled,
    poolSize: pool.length,
  };
}
