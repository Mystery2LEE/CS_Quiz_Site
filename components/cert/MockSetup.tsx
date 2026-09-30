"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXAM_MINUTES } from "@/lib/cert/public";

const numField = "w-full rounded-md border border-line px-3 py-2 bg-paper text-ink tabular-nums";
const label = "font-mono text-xs tracking-widest text-ink2 uppercase mb-2";

// 랜덤 모의고사 설정. 기본: 20문항 = 프로그래밍 8 + SQL 2 + 이론 10, 기출만, 150분
export function MockSetup() {
  const router = useRouter();
  const [total, setTotal] = useState(20);
  const [prog, setProg] = useState(8);
  const [sql, setSql] = useState(2);
  const [source, setSource] = useState<"exam" | "all">("exam");
  const [excludeSolved, setExcludeSolved] = useState(false);
  const [timerOn, setTimerOn] = useState(true);
  const [timerMin, setTimerMin] = useState(EXAM_MINUTES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const theory = total - prog - sql;
  const valid = total >= 5 && total <= 40 && prog >= 0 && sql >= 0 && theory >= 0;

  async function start() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cert/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total, prog, sql, source, excludeSolved, timerMin: timerOn ? timerMin : 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "출제 실패");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  const chip = (on: boolean) =>
    `rounded-md border px-4 py-2 text-sm transition-colors ${
      on ? "border-brand bg-brand text-white" : "border-line bg-paper hover:border-brand/50 text-ink"
    }`;

  return (
    <section className="max-w-3xl mx-auto">
      <h2 className="font-serif text-2xl text-ink mb-1">랜덤 모의고사</h2>
      <p className="text-sm text-ink2 mb-5">
        실제 시험 비율에 맞춰 무작위로 출제합니다. 다 풀고 한 번에 제출하면 100점 환산 60점 이상이 합격이에요.
      </p>

      <div className="rounded-lg border border-line bg-white/60 p-6 shadow-card space-y-6">
        <div>
          <p className={label}>1. 문항 수와 과목 비율</p>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-ink2 block mb-1">전체 (5~40)</span>
              <input
                type="number"
                min={5}
                max={40}
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
                className={numField}
              />
            </label>
            <label className="block">
              <span className="text-xs text-ink2 block mb-1">프로그래밍</span>
              <input
                type="number"
                min={0}
                max={total}
                value={prog}
                onChange={(e) => setProg(Number(e.target.value))}
                className={numField}
              />
            </label>
            <label className="block">
              <span className="text-xs text-ink2 block mb-1">SQL</span>
              <input
                type="number"
                min={0}
                max={total}
                value={sql}
                onChange={(e) => setSql(Number(e.target.value))}
                className={numField}
              />
            </label>
          </div>
          <p className={`mt-2 text-xs font-mono ${valid ? "text-ink2" : "text-red-700"}`}>
            {valid
              ? `프로그래밍 ${prog}(C·Java·Python 고르게) + SQL ${sql} + 이론 ${theory}(8개 과목에서 고르게)`
              : "전체는 5~40문항, 프로그래밍과 SQL의 합은 전체 문항 수 이하여야 합니다."}
          </p>
        </div>

        <div>
          <p className={label}>2. 출처</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSource("exam")} className={chip(source === "exam")}>
              기출만
            </button>
            <button onClick={() => setSource("all")} className={chip(source === "all")}>
              전체 (기출 + 워크북)
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={excludeSolved}
              onChange={(e) => setExcludeSolved(e.target.checked)}
              className="accent-brand"
            />
            이미 푼 문제 제외
          </label>
        </div>

        <div>
          <p className={label}>3. 타이머</p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setTimerOn(true)} className={chip(timerOn)}>
              켜기
            </button>
            <button onClick={() => setTimerOn(false)} className={chip(!timerOn)}>
              끄기
            </button>
            {timerOn && (
              <label className="flex items-center gap-2 text-sm text-ink2 ml-2">
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={timerMin}
                  onChange={(e) => setTimerMin(Number(e.target.value))}
                  className={`${numField} w-24`}
                />
                분 (시간이 끝나면 자동 제출)
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={start}
            disabled={loading || !valid || (timerOn && !(timerMin >= 1))}
            className="rounded-md bg-ink px-6 py-3 text-paper font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {loading ? "출제 중…" : "모의고사 시작"}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
