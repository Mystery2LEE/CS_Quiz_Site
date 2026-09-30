"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  emptyInputs,
  isAnswered,
  ENDLESS_EXCLUDED_YEARS,
  type PublicQuestion,
  type QResult,
} from "@/lib/cert/public";
import type { Subject } from "@/lib/cert/types";
import { QuestionCard, type UserVerdict } from "./QuestionCard";
import { postJson } from "./Runner";

type Source = "all" | "exam" | "workbook";

const BATCH = 10; // 한 번에 받아 두는 문항 수
const REFILL_AT = 3; // 남은 문항이 이만큼이면 다음 묶음을 미리 받는다

const SOURCES: { id: Source; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "exam", label: "기출" },
  { id: "workbook", label: "워크북" },
];

const chip = (on: boolean) =>
  `text-xs font-mono rounded-md border px-3 py-1.5 transition-colors ${
    on ? "border-brand bg-brand text-white" : "border-line text-ink2 hover:border-brand/50"
  }`;

// 무한 풀기: 무작위로 한 문제씩, 문항마다 바로 채점. 범위를 다 돌면 다시 섞어서 계속 낸다.
export function EndlessRunner({ subjects }: { subjects: Subject[] }) {
  const [source, setSource] = useState<Source>("all");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [queue, setQueue] = useState<PublicQuestion[]>([]);
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [inputs, setInputs] = useState<string[]>([]);
  const [result, setResult] = useState<QResult | null>(null);
  const [history, setHistory] = useState<QResult[]>([]); // 이번에 채점한 결과 (푼 순서)
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const seenRef = useRef(new Set<string>()); // 이번 바퀴에서 이미 나온 문항
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const reqRef = useRef(0); // 필터를 바꾸면 이전 요청의 응답은 버린다
  const fetchingRef = useRef(false);

  const q = queue[0];

  async function fetchMore(reset: boolean) {
    if (fetchingRef.current && !reset) return;
    const req = ++reqRef.current;
    fetchingRef.current = true;
    if (reset) setLoading(true);
    try {
      const waiting = reset ? [] : queueRef.current.map((x) => x.id);
      const data = await postJson("/api/cert/endless", {
        source,
        subject,
        count: BATCH,
        exclude: [...seenRef.current, ...waiting],
      });
      if (req !== reqRef.current) return;
      const incoming = data.questions as PublicQuestion[];
      if (data.cycled) {
        seenRef.current = new Set();
        setNotice("출제 범위의 문제를 모두 봤어요. 다시 섞어서 계속 냅니다.");
      }
      setPoolSize(data.poolSize);
      if (reset) {
        setQueue(incoming);
        setInputs(incoming[0] ? emptyInputs(incoming[0]) : []);
      } else {
        setQueue((prev) => [...prev, ...incoming.filter((n) => !prev.some((p) => p.id === n.id))]);
      }
    } catch (e: any) {
      if (req === reqRef.current) setError(e.message);
    } finally {
      if (req === reqRef.current) {
        fetchingRef.current = false;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    seenRef.current = new Set();
    setResult(null);
    setNotice("");
    setError("");
    fetchMore(true);
  }, [source, subject]);

  function next() {
    if (!q) return;
    seenRef.current.add(q.id);
    const rest = queue.slice(1);
    setQueue(rest);
    setResult(null);
    setError("");
    setNotice("");
    setInputs(rest[0] ? emptyInputs(rest[0]) : []);
    if (rest.length <= REFILL_AT) fetchMore(rest.length === 0);
  }

  async function grade() {
    if (!q) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/cert/grade", { items: [{ id: q.id, inputs }] });
      const r = data.results[0] as QResult;
      setResult(r);
      setHistory((prev) => [...prev, r]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendVerdict(verdict: UserVerdict) {
    if (!q || !result) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/cert/verdict", { id: q.id, verdict });
      const patched: QResult = {
        ...result,
        correct: data.correct,
        score: data.score,
        ...(q.answer.mode === "essay" ? { verdict } : {}),
      };
      setResult(patched);
      setHistory((prev) => prev.map((r, i) => (i === prev.length - 1 ? patched : r)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // 연속 정답: 자기 채점을 기다리는 서술형은 건너뛰고 센다
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].verdict === "pending") continue;
    if (!history[i].correct) break;
    streak += 1;
  }

  return (
    <section className="max-w-3xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-2">
        <div className="min-w-0">
          <Link href="/cert" className="text-sm text-ink2 hover:text-ink mb-1 block">
            ← 정처기 홈
          </Link>
          <h2 className="font-serif text-xl md:text-2xl text-ink">무한 풀기</h2>
        </div>
        <span className="text-xs font-mono text-ink2 shrink-0 text-right">
          정답 {history.filter((r) => r.correct).length} / 푼 문제 {history.length}
          {streak >= 2 && <span className="block text-green-700">{streak}문제 연속 정답</span>}
        </span>
      </div>
      <p className="text-sm text-ink2 mb-4">
        무작위로 한 문제씩 끝없이 나옵니다. 문항마다 바로 채점하고, 틀린 문제는 오답노트에 쌓여요.{" "}
        {ENDLESS_EXCLUDED_YEARS.join("·")}년 기출은 나오지 않습니다.
      </p>

      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-ink2 w-10">출처</span>
          {SOURCES.map((s) => (
            <button key={s.id} onClick={() => setSource(s.id)} className={chip(source === s.id)}>
              {s.label}
            </button>
          ))}
          {poolSize !== null && (
            <span className="text-xs font-mono text-ink2 ml-auto">출제 범위 {poolSize}문항</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-ink2 w-10">과목</span>
          <button onClick={() => setSubject(null)} className={chip(subject === null)}>
            전체
          </button>
          {subjects.map((s) => (
            <button key={s} onClick={() => setSubject(s)} className={chip(subject === s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <p className="mb-4 rounded-md border border-brand/40 bg-brand/5 px-3 py-2 text-sm text-brand">{notice}</p>
      )}

      {loading ? (
        <p className="text-ink2 text-sm">문제를 불러오는 중…</p>
      ) : !q ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-ink2">
          {error || "조건에 맞는 문제가 없습니다."}
        </div>
      ) : (
        <>
          <QuestionCard
            key={q.id}
            q={q}
            inputs={inputs}
            onChange={setInputs}
            result={result}
            allowReveal
            onVerdict={sendVerdict}
            busy={busy}
          />

          {error && <p className="mt-3 text-sm text-red-700 text-center">{error}</p>}

          <div className="mt-6 flex justify-center items-center gap-3">
            {result ? (
              <button
                autoFocus
                onClick={next}
                className="rounded-md bg-ink px-6 py-2 text-paper hover:bg-brand-dark transition-colors"
              >
                다음 문제
              </button>
            ) : (
              <>
                <button
                  onClick={next}
                  className="rounded-md border border-line px-5 py-2 text-ink2 hover:border-ink transition-colors"
                >
                  건너뛰기
                </button>
                <button
                  onClick={grade}
                  disabled={busy || !isAnswered(inputs)}
                  className="rounded-md bg-brand px-5 py-2 text-white hover:bg-brand-dark transition-colors disabled:opacity-50"
                >
                  {busy ? "채점 중…" : "채점하기"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
