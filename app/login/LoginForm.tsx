"use client";

import { useState } from "react";
import Link from "next/link";

// app/page.tsx의 UserAuthModal과 같은 이름+PIN 로그인 (같은 /api/user/login 사용)
export function LoginForm({ next }: { next: string }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "로그인 실패");
      window.location.assign(next);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="torn-top bg-white rounded-lg border border-line shadow-card p-6 w-full max-w-sm">
      <p className="font-mono text-xs tracking-widest text-amber uppercase mb-2">면접장 · 스터디원 전용</p>
      <h1 className="font-serif text-xl text-ink mb-1">로그인</h1>
      <p className="text-sm text-ink2 mb-4">
        정처기 실기 문제은행은 로그인 후 이용할 수 있어요. 이름과 PIN(숫자 4~6자리)을 입력하세요. 처음 쓰는
        이름이면 자동으로 계정이 만들어져요.
      </p>
      <input
        type="text"
        autoFocus
        placeholder="이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md border border-line px-3 py-2 bg-paper text-ink mb-2"
      />
      <input
        type="password"
        inputMode="numeric"
        placeholder="PIN (숫자 4~6자리)"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="w-full rounded-md border border-line px-3 py-2 bg-paper text-ink mb-2"
      />
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <Link
          href="/"
          className="flex-1 text-center rounded-md border border-line px-4 py-2 text-ink2 hover:border-ink transition-colors"
        >
          면접장으로
        </Link>
        <button
          onClick={submit}
          disabled={loading}
          className="flex-1 rounded-md bg-ink px-4 py-2 text-paper hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {loading ? "확인 중…" : "로그인 / 가입"}
        </button>
      </div>
    </div>
  );
}
