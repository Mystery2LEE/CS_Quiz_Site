// 내 진행률 집계 (서버 전용)
import { allQuestions, SUBJECTS } from "./data";
import type { Subject } from "./types";
import type { QStat } from "./store";

export interface Progress {
  total: number; // 문항 수
  solved: number; // 한 번이라도 푼 문항 수
  correct: number; // 누적 정답 횟수
  wrong: number; // 누적 오답 횟수
  accuracy: number | null; // 정답률(%) — 채점된 시도가 없으면 null
}

const empty = (): Progress => ({ total: 0, solved: 0, correct: 0, wrong: 0, accuracy: null });

function finish(p: Progress): Progress {
  const graded = p.correct + p.wrong;
  return { ...p, accuracy: graded ? Math.round((p.correct / graded) * 100) : null };
}

export function progressOf(stats: Record<string, QStat>): {
  overall: Progress;
  bySubject: { subject: Subject; progress: Progress }[];
} {
  const overall = empty();
  const map = new Map<Subject, Progress>(SUBJECTS.map((s) => [s, empty()]));
  for (const q of allQuestions()) {
    const s = stats[q.id];
    for (const p of [overall, map.get(q.subject)!]) {
      p.total += 1;
      if (s && s.tries > 0) {
        p.solved += 1;
        p.correct += s.correct;
        p.wrong += s.wrong;
      }
    }
  }
  return {
    overall: finish(overall),
    bySubject: SUBJECTS.map((subject) => ({ subject, progress: finish(map.get(subject)!) })),
  };
}

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
