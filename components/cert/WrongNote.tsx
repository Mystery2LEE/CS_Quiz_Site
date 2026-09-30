"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MODE_LABELS, MODE_STYLES } from "@/lib/cert/public";
import type { AnswerMode } from "@/lib/cert/types";

async function post(body: unknown) {
  const res = await fetch("/api/cert/wrong", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "저장 실패");
}

export function MemoBox({ id, initial }: { id: string; initial: string }) {
  const [memo, setMemo] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function save() {
    setState("saving");
    try {
      await post({ action: "memo", id, memo });
      setSaved(memo);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      <textarea
        rows={2}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        maxLength={1000}
        placeholder="메모 (헷갈린 이유, 외울 포인트 등)"
        className="w-full rounded-md border border-line px-3 py-2 bg-paper text-sm text-ink placeholder:text-ink2/50 resize-y"
      />
      <div className="mt-1 flex items-center gap-2">
        <button
          onClick={save}
          disabled={state === "saving" || memo === saved}
          className="text-xs rounded-md border border-line text-ink2 px-3 py-1.5 hover:border-brand hover:text-brand transition-colors disabled:opacity-40"
        >
          {state === "saving" ? "저장 중…" : "메모 저장"}
        </button>
        {state === "error" && <span className="text-xs text-red-700">저장하지 못했어요.</span>}
        {state === "idle" && memo === saved && saved !== "" && (
          <span className="text-xs font-mono text-ink2">저장됨</span>
        )}
      </div>
    </div>
  );
}

export function GraduateToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState(false);

  async function toggle(next: boolean) {
    setOn(next);
    setError(false);
    try {
      await post({ action: "prefs", graduateNow: next });
    } catch {
      setOn(!next);
      setError(true);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="accent-brand" />
      한 번만 맞혀도 바로 제거 (기본: 연속 2회 정답 시 졸업)
      {error && <span className="text-xs text-red-700">저장하지 못했어요.</span>}
    </label>
  );
}

export type WrongEntry = {
  id: string;
  source: string;
  subject: string;
  mode: AnswerMode;
  prompt: string;
  wrong: number;
  streak: number;
  memo: string;
  lastAt: string;
};

export function WrongItem({ entry, need }: { entry: WrongEntry; need: number }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    setRemoving(true);
    try {
      await post({ action: "remove", id: entry.id });
      router.refresh();
    } catch {
      setRemoving(false);
    }
  }

  const chip = "text-[10px] font-mono px-1.5 py-0.5 rounded border";
  return (
    <div
      className="torn-top rounded-lg border border-line bg-white shadow-card p-4"
      style={{ borderLeftWidth: 4, borderLeftColor: MODE_STYLES[entry.mode].tab }}
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className={`${chip} border-line bg-paper text-ink2`}>{entry.source}</span>
        <span className={`${chip} border-line bg-paper text-ink2`}>{entry.subject}</span>
        <span className={`${chip} ${MODE_STYLES[entry.mode].badge}`}>{MODE_LABELS[entry.mode]}</span>
        <span className="text-[10px] font-mono text-ink2 ml-auto">{entry.lastAt}</span>
      </div>
      <p className="text-sm text-ink mb-2 leading-snug">{entry.prompt}</p>
      <p className="text-xs font-mono text-red-700 mb-3">
        오답 {entry.wrong}회 · 연속 정답 {Math.min(entry.streak, need)} / {need}
      </p>
      <MemoBox id={entry.id} initial={entry.memo} />
      <div className="mt-3 pt-3 border-t border-line/70 flex items-center gap-2">
        <Link
          href={`/cert/q/${entry.id}`}
          className="text-xs rounded-md border border-brand text-brand px-3 py-1.5 hover:bg-brand hover:text-white transition-colors"
        >
          문제·해설 보기
        </Link>
        <button
          onClick={remove}
          disabled={removing}
          className="text-xs rounded-md border border-line text-ink2 px-3 py-1.5 hover:border-red-600/60 hover:text-red-700 transition-colors disabled:opacity-50"
        >
          오답노트에서 제거
        </button>
      </div>
    </div>
  );
}
