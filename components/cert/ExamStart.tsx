"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EXAM_MINUTES } from "@/lib/cert/public";

// 회차 풀이 시작 화면: 실전 모드 / 연습 모드 선택
export function ExamStart({ setId, title, count }: { setId: string; title: string; count: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startExam() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cert/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "시작 실패");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <section className="max-w-3xl mx-auto">
      <Link href="/cert/exam" className="text-sm text-ink2 hover:text-ink mb-2 block">
        ← 회차 목록
      </Link>
      <h2 className="font-serif text-2xl text-ink mb-1">{title}</h2>
      <p className="text-sm text-ink2 mb-6">{count}문항 · 풀이 방식을 골라주세요.</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div
          className="torn-top rounded-lg border border-line bg-white shadow-card p-5 flex flex-col"
          style={{ borderLeftWidth: 4, borderLeftColor: "#4338CA" }}
        >
          <p className="font-serif text-lg text-ink mb-1">실전 모드</p>
          <p className="text-sm text-ink2 mb-4 flex-1">
            {EXAM_MINUTES}분 타이머. 다 풀고 한 번에 제출하면 점수와 합격 여부, 과목별 결과가 나옵니다. 새로고침해도
            답안과 남은 시간이 유지돼요.
          </p>
          <button
            onClick={startExam}
            disabled={loading}
            className="rounded-md bg-ink px-4 py-2 text-sm text-paper hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {loading ? "준비 중…" : "실전 모드 시작"}
          </button>
        </div>

        <div
          className="torn-top rounded-lg border border-line bg-white shadow-card p-5 flex flex-col"
          style={{ borderLeftWidth: 4, borderLeftColor: "#0F7A72" }}
        >
          <p className="font-serif text-lg text-ink mb-1">연습 모드</p>
          <p className="text-sm text-ink2 mb-4 flex-1">
            타이머 없이 문항마다 바로 채점하고 해설을 봅니다. 풀기 전에 밀어서 정답을 확인할 수도 있어요.
          </p>
          <Link
            href={`/cert/exam/${setId}?mode=practice`}
            className="text-center rounded-md border border-line px-4 py-2 text-sm text-ink hover:border-brand hover:text-brand transition-colors"
          >
            연습 모드 시작
          </Link>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
