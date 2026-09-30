"use client";

import { useState } from "react";
import { MODE_LABELS, MODE_STYLES, type PublicQuestion, type QResult } from "@/lib/cert/public";
import { DragReveal } from "./DragReveal";

export type UserVerdict = "full" | "partial" | "wrong";

const chip = "text-[10px] font-mono px-1.5 py-0.5 rounded border";
const field =
  "w-full rounded-md border px-3 py-2 bg-paper text-ink placeholder:text-ink2/50 disabled:opacity-100";

function blankPlaceholder(b: { label: string | null; set?: boolean; seq?: boolean }) {
  if (b.set) return "쉼표로 구분해 모두 입력";
  if (b.seq) return "순서대로 입력 (예: A → B → C)";
  return "답 입력";
}

function Solution({ mode, answer, explanation }: { mode: string; answer: string; explanation: string }) {
  return (
    <div>
      <p className="text-xs font-mono text-ink2 uppercase tracking-wide mb-1">정답</p>
      <pre
        className={`whitespace-pre-wrap break-words rounded-md border border-line bg-paper p-3 text-sm text-ink ${
          mode === "output" ? "font-mono" : "font-sans"
        }`}
      >
        {answer}
      </pre>
      {explanation.trim() && (
        <details className="mt-3" open>
          <summary className="text-xs font-mono text-ink2 uppercase tracking-wide cursor-pointer select-none">
            해설
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-ink2 leading-relaxed">
            {explanation}
          </pre>
        </details>
      )}
    </div>
  );
}

function statusOf(r: QResult): { text: string; cls: string } {
  const pts = `${r.score} / ${r.maxScore}점`;
  if (r.verdict === "pending") {
    return { text: "자기 채점이 필요합니다 — 모범답안과 비교해 아래에서 골라주세요.", cls: "text-amber" };
  }
  if (r.correct && r.blanks.some((b) => !b.correct)) {
    return { text: `정답으로 인정했습니다 (${pts})`, cls: "text-green-700" };
  }
  if (r.correct) return { text: `정답입니다 (${pts})`, cls: "text-green-700" };
  if (r.score > 0) return { text: `부분 정답 (${pts})`, cls: "text-amber" };
  return { text: `오답입니다 (${pts})`, cls: "text-red-700" };
}

export function QuestionCard({
  q,
  index,
  inputs,
  onChange,
  result,
  allowReveal,
  onVerdict,
  busy,
}: {
  q: PublicQuestion;
  index?: number;
  inputs: string[];
  onChange?: (inputs: string[]) => void;
  result?: QResult | null;
  allowReveal?: boolean; // 연습 모드: 풀기 전에 밀어서 정답 보기
  onVerdict?: (v: UserVerdict) => void; // "정답으로 인정" / 서술형 자기 채점
  busy?: boolean;
}) {
  const { mode, blanks, ordered, note } = q.answer;
  const locked = !!result || !onChange;
  const [peek, setPeek] = useState<{ answer: string; explanation: string } | null>(null);
  const [peekError, setPeekError] = useState("");

  function setInput(i: number, value: string) {
    if (!onChange) return;
    const next = [...inputs];
    next[i] = value;
    onChange(next);
  }

  async function loadPeek() {
    try {
      const res = await fetch("/api/cert/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "불러오기 실패");
      setPeek(data);
    } catch (e: any) {
      setPeekError(e.message);
    }
  }

  const resultBorder = (ok: boolean | undefined) =>
    ok === undefined ? "border-line" : ok ? "border-green-600 bg-green-50" : "border-red-600 bg-red-50";

  const status = result ? statusOf(result) : null;

  return (
    <article
      className="torn-top rounded-lg border border-line bg-white shadow-card p-5 md:p-6"
      style={{ borderLeftWidth: 4, borderLeftColor: MODE_STYLES[mode].tab }}
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {index !== undefined && (
          <span className="font-mono text-xs text-ink2 tracking-wide mr-1">
            Q{String(index + 1).padStart(2, "0")}
          </span>
        )}
        <span className={`${chip} border-line bg-paper text-ink2`}>{q.source}</span>
        <span className={`${chip} border-line bg-paper text-ink2`}>{q.subject}</span>
        <span className={`${chip} border-line bg-paper text-ink2`}>{q.points}점</span>
        <span className={`${chip} ${MODE_STYLES[mode].badge}`}>{MODE_LABELS[mode]}</span>
      </div>

      <p className="font-serif text-lg text-ink mb-4 leading-snug whitespace-pre-wrap">{q.prompt}</p>

      {q.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={q.image}
          alt={`${q.source} 지문`}
          className="max-w-full h-auto rounded-md border border-line bg-white mb-4"
        />
      ) : q.body.trim() ? (
        q.lang ? (
          <div className="relative rounded-md bg-ink mb-4">
            <span className="absolute top-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-paper/80">
              {q.lang}
            </span>
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-paper p-4 pr-14">
              {q.body}
            </pre>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-ink rounded-md border border-line bg-paper p-3 mb-4">
            {q.body}
          </pre>
        )
      ) : null}

      {mode === "short" && (
        <div className="space-y-2">
          {!ordered && blanks.length > 1 && (
            <p className="text-xs font-mono text-ink2">순서 무관 — 어느 칸에 써도 됩니다.</p>
          )}
          {blanks.map((b, i) => {
            const br = result?.blanks[i];
            const cls = `${field} ${resultBorder(br?.correct)}`;
            return (
              <div key={i} className="flex items-start gap-2">
                {b.label && (
                  <span className="shrink-0 min-w-[1.75rem] pt-2 text-sm font-mono text-ink2">{b.label}</span>
                )}
                {b.label === "SQL" ? (
                  <textarea
                    rows={3}
                    value={inputs[i] ?? ""}
                    onChange={(e) => setInput(i, e.target.value)}
                    disabled={locked}
                    placeholder="SQL문 입력"
                    className={`${cls} font-mono text-sm resize-y`}
                  />
                ) : (
                  <input
                    type="text"
                    value={inputs[i] ?? ""}
                    onChange={(e) => setInput(i, e.target.value)}
                    disabled={locked}
                    placeholder={blankPlaceholder(b)}
                    className={cls}
                  />
                )}
                {br && (
                  <span
                    className={`shrink-0 pt-2 font-mono text-sm ${br.correct ? "text-green-700" : "text-red-700"}`}
                    aria-label={br.correct ? "정답" : "오답"}
                  >
                    {br.correct ? "✓" : "✗"}
                  </span>
                )}
              </div>
            );
          })}
          {note && <p className="text-xs text-ink2">※ {note}</p>}
        </div>
      )}

      {mode === "output" && (
        <div>
          <textarea
            rows={4}
            value={inputs[0] ?? ""}
            onChange={(e) => setInput(0, e.target.value)}
            disabled={locked}
            placeholder="실행 결과 입력"
            className={`${field} ${resultBorder(result?.blanks[0]?.correct)} font-mono text-sm resize-y`}
          />
          <p className="mt-1 text-xs font-mono text-ink2">출력 서식(공백·쉼표)까지 정확히</p>
          {note && <p className="text-xs text-ink2">※ {note}</p>}
        </div>
      )}

      {mode === "essay" && (
        <div>
          <textarea
            rows={4}
            value={inputs[0] ?? ""}
            onChange={(e) => setInput(0, e.target.value)}
            disabled={locked}
            placeholder="서술형 답안 입력"
            className={`${field} border-line resize-y`}
          />
          {note && <p className="mt-1 text-xs text-ink2">※ {note}</p>}
        </div>
      )}

      {!result && allowReveal && (
        <div className="mt-4">
          <DragReveal onReveal={loadPeek}>
            {peek ? (
              <Solution mode={mode} answer={peek.answer} explanation={peek.explanation} />
            ) : (
              <p className="text-sm text-ink2">{peekError || "불러오는 중…"}</p>
            )}
          </DragReveal>
        </div>
      )}

      {result && status && (
        <div className="mt-4 pt-4 border-t border-line/70">
          <p className={`text-sm font-medium mb-3 ${status.cls}`}>{status.text}</p>

          {result.keywordHits && result.keywordHits.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-mono text-ink2 uppercase tracking-wide mb-1.5">필수 표현</p>
              <div className="flex flex-wrap gap-1.5">
                {result.keywordHits.map((k, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2 py-1 rounded border ${
                      k.hit
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "border-red-600/50 bg-red-50 text-red-700"
                    }`}
                  >
                    {k.hit ? "✓" : "✗"} {k.keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Solution mode={mode} answer={result.answer} explanation={result.explanation} />

          {onVerdict && mode !== "essay" && !result.correct && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => onVerdict("full")}
                disabled={busy}
                className="text-xs rounded-md border border-line px-3 py-1.5 text-ink2 hover:border-green-600/60 hover:text-green-700 transition-colors disabled:opacity-50"
              >
                정답으로 인정
              </button>
              <span className="text-xs text-ink2">표기만 다르고 맞게 썼다면 눌러주세요.</span>
            </div>
          )}

          {onVerdict && mode === "essay" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink2 font-mono">스스로 채점:</span>
              {(
                [
                  ["full", "맞음", "border-green-600 bg-green-50 text-green-700", "hover:border-green-600/60"],
                  ["partial", "부분", "border-amber bg-amber/10 text-amber", "hover:border-amber/60"],
                  ["wrong", "틀림", "border-red-600 bg-red-50 text-red-700", "hover:border-red-600/60"],
                ] as const
              ).map(([v, label, on, off]) => (
                <button
                  key={v}
                  onClick={() => onVerdict(v)}
                  disabled={busy}
                  className={`text-xs rounded-md border px-3 py-1.5 transition-colors disabled:opacity-50 ${
                    result.verdict === v ? on : `border-line text-ink2 ${off}`
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
