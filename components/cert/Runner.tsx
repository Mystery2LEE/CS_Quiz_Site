"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  emptyInputs,
  isAnswered,
  type PublicQuestion,
  type QResult,
  type SessionSummary,
} from "@/lib/cert/public";
import { QuestionCard, type UserVerdict } from "./QuestionCard";
import { CountdownTimer } from "./CountdownTimer";

type Props = {
  questions: PublicQuestion[];
  // practice: 문항마다 바로 채점·해설 / exam: 다 풀고 한 번에 제출 → 점수·합격 판정
  mode: "practice" | "exam";
  title: string;
  backHref: string;
  backLabel: string;
  sid?: string; // exam: 드래프트 id
  endsAt?: number | null; // exam: 마감 시각
  initialInputs?: Record<string, string[]>;
};

export async function postJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청 실패");
  return data;
}

function navClass(r: QResult | undefined, answered: boolean, active: boolean) {
  let cls = "border-line text-ink2 bg-white hover:border-brand/50";
  if (r) {
    if (r.verdict === "pending") cls = "border-amber/60 bg-amber/10 text-amber";
    else if (r.correct) cls = "border-green-600 bg-green-50 text-green-700";
    else if (r.score > 0) cls = "border-amber bg-amber/10 text-amber";
    else cls = "border-red-600 bg-red-50 text-red-700";
  } else if (answered) {
    cls = "border-brand/40 bg-brand/10 text-brand";
  }
  return `${cls} ${active ? "ring-2 ring-ink/70" : ""}`;
}

function Report({ summary }: { summary: SessionSummary }) {
  return (
    <div className="torn-top rounded-lg border border-line bg-white shadow-card p-6 mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-xs tracking-widest text-ink2 uppercase mb-1">채점 결과</p>
          <p className="font-serif text-4xl text-ink tabular-nums">
            {summary.score100}
            <span className="text-lg text-ink2 font-sans font-normal"> / 100점</span>
          </p>
          <p className="text-xs font-mono text-ink2 mt-1">
            득점 {summary.got} / 배점 {summary.max} · 60점 이상 합격
          </p>
        </div>
        <span
          className={`font-serif text-2xl px-4 py-2 rounded-md border-2 ${
            summary.pass ? "border-green-600 text-green-700" : "border-red-600 text-red-700"
          }`}
        >
          {summary.pass ? "합격" : "불합격"}
        </span>
      </div>

      {summary.pending > 0 && (
        <p className="mb-4 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">
          자기 채점이 필요한 서술형 {summary.pending}문항은 아직 0점으로 계산돼 있어요. 아래에서 채점하면 점수에
          반영됩니다.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-mono text-ink2 border-b border-line">
              <th className="py-2 font-normal">과목</th>
              <th className="py-2 font-normal text-right">문항</th>
              <th className="py-2 font-normal text-right">득점</th>
              <th className="py-2 font-normal text-right">정답률</th>
            </tr>
          </thead>
          <tbody>
            {summary.bySubject.map((s) => (
              <tr key={s.subject} className="border-b border-line/60">
                <td className="py-2 text-ink">{s.subject}</td>
                <td className="py-2 text-right tabular-nums text-ink2">{s.n}</td>
                <td className="py-2 text-right tabular-nums text-ink2">
                  {s.got} / {s.max}
                </td>
                <td className="py-2 text-right tabular-nums text-ink">
                  {s.max ? Math.round((s.got / s.max) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Runner({ questions, mode, title, backHref, backLabel, sid, endsAt, initialInputs }: Props) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const q of questions) init[q.id] = initialInputs?.[q.id] ?? emptyInputs(q);
    return init;
  });
  const [results, setResults] = useState<Record<string, QResult>>({});
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const submittedRef = useRef(false);
  const dirtyRef = useRef(false);

  const isExam = mode === "exam";
  const examDone = isExam && summary !== null;
  const q = questions[idx];

  // 실전/모의고사: 답안을 드래프트에 임시 저장 (새로고침·이탈 복구)
  useEffect(() => {
    if (!isExam || !sid || !dirtyRef.current || submittedRef.current) return;
    const t = setTimeout(() => {
      if (submittedRef.current) return;
      postJson("/api/cert/draft", { sid, inputs: inputsRef.current }, "PUT").catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [inputs, isExam, sid]);

  function changeInputs(id: string, next: string[]) {
    dirtyRef.current = true;
    setInputs((prev) => ({ ...prev, [id]: next }));
  }

  async function submitExam() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const items = questions.map((x) => ({ id: x.id, inputs: inputsRef.current[x.id] ?? [] }));
      const data = await postJson("/api/cert/grade", { sid, items });
      const map: Record<string, QResult> = {};
      for (const r of data.results as QResult[]) map[r.id] = r;
      setResults(map);
      setSummary(data.summary);
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      submittedRef.current = false;
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function confirmSubmit() {
    const blank = questions.filter((x) => !isAnswered(inputs[x.id])).length;
    const msg = blank > 0 ? `아직 ${blank}문항을 풀지 않았어요. 그래도 제출할까요?` : "답안을 제출할까요?";
    if (confirm(msg)) submitExam();
  }

  async function abandonExam() {
    if (!confirm("시험을 그만둘까요? 작성한 답안은 삭제됩니다.")) return;
    submittedRef.current = true;
    await postJson("/api/cert/draft", { sid }, "DELETE").catch(() => {});
    router.refresh();
  }

  async function gradeOne(target: PublicQuestion) {
    setBusyId(target.id);
    setError("");
    try {
      const data = await postJson("/api/cert/grade", {
        items: [{ id: target.id, inputs: inputs[target.id] ?? [] }],
      });
      setResults((prev) => ({ ...prev, [target.id]: data.results[0] }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  function retryOne(target: PublicQuestion) {
    setResults((prev) => {
      const next = { ...prev };
      delete next[target.id];
      return next;
    });
    setInputs((prev) => ({ ...prev, [target.id]: emptyInputs(target) }));
  }

  async function sendVerdict(target: PublicQuestion, verdict: UserVerdict) {
    setBusyId(target.id);
    setError("");
    try {
      const data = await postJson("/api/cert/verdict", {
        id: target.id,
        verdict,
        ...(summary ? { sessionId: summary.sessionId } : {}),
      });
      setResults((prev) => ({
        ...prev,
        [target.id]: {
          ...prev[target.id],
          correct: data.correct,
          score: data.score,
          ...(target.answer.mode === "essay" ? { verdict } : {}),
        },
      }));
      if (data.summary) setSummary(data.summary);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (questions.length === 0) {
    return (
      <section>
        <Link href={backHref} className="text-sm text-ink2 hover:text-ink mb-4 block">
          ← {backLabel}
        </Link>
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-ink2">
          조건에 맞는 문제가 없습니다.
        </div>
      </section>
    );
  }

  // 실전/모의고사 제출 후: 점수·합격 판정·과목별 표 + 전체 문항 해설
  if (examDone && summary) {
    return (
      <section className="max-w-3xl mx-auto">
        <Link href={backHref} className="text-sm text-ink2 hover:text-ink mb-4 block">
          ← {backLabel}
        </Link>
        <h2 className="font-serif text-2xl text-ink mb-4">{title}</h2>
        <Report summary={summary} />
        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
        <div className="space-y-4">
          {questions.map((x, i) => (
            <QuestionCard
              key={x.id}
              q={x}
              index={i}
              inputs={results[x.id]?.inputs ?? inputs[x.id] ?? []}
              result={results[x.id]}
              onVerdict={(v) => sendVerdict(x, v)}
              busy={busyId === x.id}
            />
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={backHref}
            className="rounded-md border border-line px-5 py-2 text-ink2 hover:border-ink transition-colors"
          >
            {backLabel}
          </Link>
          <button
            onClick={() => router.refresh()}
            className="rounded-md border border-brand px-5 py-2 text-brand hover:bg-brand hover:text-white transition-colors"
          >
            다시 응시
          </button>
        </div>
      </section>
    );
  }

  const result = results[q.id];
  const solved = Object.values(results);
  const showTopics = questions.some((x) => x.topic);
  const single = questions.length === 1; // 단일 문제 페이지: 문항 이동 UI를 숨긴다

  return (
    <section className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="min-w-0">
          <Link href={backHref} className="text-sm text-ink2 hover:text-ink mb-1 block">
            ← {backLabel}
          </Link>
          <h2 className="font-serif text-xl md:text-2xl text-ink truncate">{title}</h2>
        </div>
        {isExam ? (
          endsAt ? (
            <CountdownTimer endsAt={endsAt} onExpire={submitExam} />
          ) : (
            <span className="text-xs font-mono text-ink2 shrink-0">타이머 없음</span>
          )
        ) : (
          <span className="text-xs font-mono text-ink2 shrink-0">
            정답 {solved.filter((r) => r.correct).length} / 푼 문제 {solved.length}
          </span>
        )}
      </div>

      <div
        className={`mb-4 rounded-lg border border-line bg-white/60 p-3 max-h-40 overflow-y-auto ${
          single ? "hidden" : ""
        }`}
      >
        <div className="flex flex-wrap gap-1.5">
          {questions.map((x, i) => (
            <span key={x.id} className="contents">
              {showTopics && x.topic && x.topic !== questions[i - 1]?.topic && (
                <span className="basis-full text-[11px] font-mono text-ink2 mt-1 first:mt-0">{x.topic}</span>
              )}
              <button
                onClick={() => setIdx(i)}
                className={`w-8 h-8 rounded-md border text-xs font-mono tabular-nums transition-colors ${navClass(
                  results[x.id],
                  isAnswered(inputs[x.id]),
                  i === idx
                )}`}
              >
                {i + 1}
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className={`text-center mb-2 font-mono text-xs text-ink2 ${single ? "hidden" : ""}`}>
        {idx + 1} / {questions.length}
        {q.topic ? ` · ${q.topic}` : ""}
      </div>

      <QuestionCard
        key={q.id}
        q={q}
        index={idx}
        inputs={inputs[q.id] ?? []}
        onChange={(next) => changeInputs(q.id, next)}
        result={result}
        allowReveal={!isExam}
        onVerdict={(v) => sendVerdict(q, v)}
        busy={busyId === q.id}
      />

      {error && <p className="mt-3 text-sm text-red-700 text-center">{error}</p>}

      <div className="mt-6 flex justify-center items-center gap-3">
        <button
          disabled={idx === 0}
          onClick={() => setIdx((i) => i - 1)}
          className={`rounded-md border border-line px-5 py-2 text-ink2 disabled:opacity-30 ${single ? "hidden" : ""}`}
        >
          이전
        </button>
        {isExam ? (
          <button
            onClick={confirmSubmit}
            disabled={submitting}
            className="rounded-md bg-brand px-5 py-2 text-white hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {submitting ? "채점 중…" : "제출하고 채점"}
          </button>
        ) : result ? (
          <button
            onClick={() => retryOne(q)}
            className="rounded-md border border-brand px-5 py-2 text-brand hover:bg-brand hover:text-white transition-colors"
          >
            다시 풀기
          </button>
        ) : (
          <button
            onClick={() => gradeOne(q)}
            disabled={busyId === q.id || !isAnswered(inputs[q.id])}
            className="rounded-md bg-brand px-5 py-2 text-white hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {busyId === q.id ? "채점 중…" : "채점하기"}
          </button>
        )}
        <button
          disabled={idx === questions.length - 1}
          onClick={() => setIdx((i) => i + 1)}
          className={`rounded-md bg-ink px-5 py-2 text-paper disabled:opacity-30 ${single ? "hidden" : ""}`}
        >
          다음 문제
        </button>
      </div>

      {isExam && (
        <p className="text-center mt-4">
          <button onClick={abandonExam} className="text-xs font-mono text-ink2 hover:text-red-700">
            시험 그만두기 (답안 삭제)
          </button>
        </p>
      )}
    </section>
  );
}
