// 랜덤 모의고사 출제 (서버 전용)
import { allQuestions, kindOf, shuffled, SUBJECTS } from "./data";
import { EXAM_MINUTES, LANGS } from "./public";
import type { CertQuestion } from "./types";

export interface MockConfig {
  total: number; // 전체 문항 수
  prog: number; // 프로그래밍 문항 수 (C·Java·Python 고르게)
  sql: number; // SQL 문항 수. 나머지는 이론 과목에서 고르게
  source: "exam" | "all"; // 기출만 / 워크북 포함 전체
  excludeSolved: boolean; // 이미 푼 문제 제외
  timerMin: number; // 0이면 타이머 끔
}

export const DEFAULT_MOCK: MockConfig = {
  total: 20, prog: 8, sql: 2, source: "exam", excludeSolved: false, timerMin: EXAM_MINUTES,
};

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalizeMockConfig(raw: any): MockConfig {
  const total = clampInt(raw?.total, 5, 40, DEFAULT_MOCK.total);
  const prog = clampInt(raw?.prog, 0, total, Math.min(DEFAULT_MOCK.prog, total));
  const sql = clampInt(raw?.sql, 0, total - prog, Math.min(DEFAULT_MOCK.sql, total - prog));
  return {
    total,
    prog,
    sql,
    source: raw?.source === "all" ? "all" : "exam",
    excludeSolved: raw?.excludeSolved === true,
    timerMin: clampInt(raw?.timerMin, 0, 300, DEFAULT_MOCK.timerMin),
  };
}

export function pickMock(cfg: MockConfig, solved: Set<string>): CertQuestion[] {
  const pool = allQuestions().filter((q) => cfg.source === "all" || kindOf(q) === "exam");
  const fresh = cfg.excludeSolved ? pool.filter((q) => !solved.has(q.id)) : pool;
  const picked = new Map<string, CertQuestion>();

  // 후보에서 무작위로 n개. 못 채운 개수를 돌려준다.
  const take = (cands: CertQuestion[], n: number): number => {
    for (const q of shuffled(cands)) {
      if (n <= 0) break;
      if (picked.has(q.id)) continue;
      picked.set(q.id, q);
      n -= 1;
    }
    return n;
  };

  // 여러 그룹에서 한 문항씩 돌아가며 뽑아 고르게 나눈다.
  const spread = (groups: CertQuestion[][], n: number): number => {
    const queues = shuffled(groups.map((g) => shuffled(g.filter((q) => !picked.has(q.id)))));
    while (n > 0 && queues.some((g) => g.length > 0)) {
      for (const g of queues) {
        if (n <= 0) break;
        const q = g.pop();
        if (!q) continue;
        picked.set(q.id, q);
        n -= 1;
      }
    }
    return n;
  };

  const prog = fresh.filter((q) => q.subject === "프로그래밍");
  const progShort = spread(LANGS.map((l) => prog.filter((q) => q.lang === l)), cfg.prog);
  take(prog, progShort);

  take(fresh.filter((q) => q.subject === "SQL"), cfg.sql);

  const theory = SUBJECTS.filter((s) => s !== "프로그래밍" && s !== "SQL");
  spread(theory.map((s) => fresh.filter((q) => q.subject === s)), cfg.total - cfg.prog - cfg.sql);

  // 조건에 맞는 문제가 모자라면 남은 문제로, 그래도 모자라면 이미 푼 문제로 채운다.
  let short = cfg.total - picked.size;
  if (short > 0) short = take(fresh, short);
  if (short > 0) take(pool, short);

  return shuffled([...picked.values()]);
}
