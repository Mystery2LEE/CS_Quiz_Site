"use client";

import { useEffect, useRef, useState } from "react";

type Term = { term: string; definition: string };
type Question = {
  question: string;
  model_answer: string;
  follow_up: string;
  terms: Term[];
  tag: string;
};
type QuestionSet = {
  id: string;
  createdAt: number;
  category: string;
  categoryLabel: string;
  difficulty: string;
  questions: Question[];
};

const CATEGORIES = [
  { id: "computer-architecture", label: "컴퓨터구조", desc: "캐시, 메모리 계층, RISC/CISC" },
  { id: "os", label: "운영체제", desc: "프로세스/스레드, 스케줄링, 동기화" },
  { id: "network", label: "네트워크", desc: "TCP/IP, HTTP, DNS" },
  { id: "data-structure", label: "자료구조", desc: "트리, 그래프, 해시, 복잡도" },
  { id: "database", label: "데이터베이스", desc: "모델링, 정규화, 인덱스, SQL" },
  { id: "data-engineering", label: "데이터 엔지니어링", desc: "ETL, Airflow, Spark, Kafka" },
  { id: "distributed", label: "분산시스템", desc: "샤딩, 복제, CAP 이론" },
  { id: "ml-basics", label: "분석/ML 기초", desc: "과적합, 평가지표, 피처엔지니어링" },
  { id: "security", label: "보안/인증", desc: "암호화, OAuth, JWT" },
  { id: "swe-general", label: "SW공학/Git/API", desc: "설계 원칙, 협업, 버전관리" },
];

const DIFFICULTIES = [
  { id: "basic", label: "기초", desc: "개념 정의 위주" },
  { id: "intermediate", label: "중급", desc: "실무 연결·비교" },
  { id: "advanced", label: "심화", desc: "꼬리질문·트레이드오프" },
];

function AnswerReveal({ text, label = "밀어서 정답 확인" }: { text: string; label?: string }) {
  const [revealed, setRevealed] = useState(false);
  const [dragPct, setDragPct] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(100, Math.max(0, pct));
    setDragPct(clamped);
    if (clamped < 18) {
      setRevealed(true);
      draggingRef.current = false;
    }
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
    if (!revealed) setDragPct(100);
  };

  if (revealed) {
    return <div className="text-ink2 leading-relaxed whitespace-pre-wrap">{text}</div>;
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-md border border-line bg-white"
      style={{ minHeight: "3.2rem" }}
    >
      <div className="p-3 text-ink2 leading-relaxed whitespace-pre-wrap opacity-0 select-none">
        {text}
      </div>
      <div
        className="redact-bar absolute inset-y-0 left-0 bg-ink text-paper flex items-center justify-end pr-3 gap-2"
        style={{ width: `${dragPct}%`, transition: draggingRef.current ? "none" : "width 0.25s ease" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="text-xs font-mono tracking-wide whitespace-nowrap opacity-80">{label}</span>
        <span className="hint-arrow font-mono text-sm">◀</span>
      </div>
    </div>
  );
}

function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "로그인 실패");
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-card p-6 w-full max-w-sm">
        <h3 className="font-serif text-xl text-ink mb-1">관리자 로그인</h3>
        <p className="text-sm text-ink2 mb-4">문제 생성 권한이 있는 관리자만 로그인할 수 있습니다.</p>
        <input
          type="password"
          autoFocus
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full rounded-md border border-line px-3 py-2 bg-paper text-ink mb-2"
        />
        {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-line px-4 py-2 text-ink2 hover:border-ink transition-colors"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 rounded-md bg-ink px-4 py-2 text-paper hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {loading ? "확인 중…" : "로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [count, setCount] = useState(5);
  const [focus, setFocus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [current, setCurrent] = useState<QuestionSet | null>(null);

  const [mode, setMode] = useState<"browse" | "list" | "interview">("browse");
  const [interviewIdx, setInterviewIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [timerOn, setTimerOn] = useState(false);

  async function refreshAuth() {
    const res = await fetch("/api/admin/check");
    const data = await res.json();
    setIsAdmin(!!data.isAdmin);
    setAuthChecked(true);
  }

  async function refreshSets() {
    setSetsLoading(true);
    try {
      const res = await fetch("/api/sets");
      const data = await res.json();
      setSets(data.sets || []);
    } finally {
      setSetsLoading(false);
    }
  }

  useEffect(() => {
    refreshAuth();
    refreshSets();
  }, []);

  useEffect(() => {
    if (!timerOn) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerOn]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const r = (s % 60).toString().padStart(2, "0");
    return `${m}:${r}`;
  };

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, difficulty, count, focus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");

      setSets((prev) => [data.set, ...prev]);
      setCurrent(data.set);
      setMode("list");
    } catch (e: any) {
      setError(e.message || "문제 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSet(id: string) {
    if (!confirm("이 문제 세트를 삭제할까요? 팀원 전체에게서 사라집니다.")) return;
    const res = await fetch(`/api/sets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSets((prev) => prev.filter((s) => s.id !== id));
      if (current?.id === id) {
        setCurrent(null);
        setMode("browse");
      }
    }
  }

  function openSet(set: QuestionSet) {
    setCurrent(set);
    setMode("list");
  }

  function startInterview(set: QuestionSet) {
    setCurrent(set);
    setMode("interview");
    setInterviewIdx(0);
    setSeconds(0);
    setTimerOn(true);
  }

  function exportMarkdown(set: QuestionSet) {
    let md = `# ${set.categoryLabel} 면접 질문 (${set.difficulty})\n\n`;
    set.questions.forEach((q, i) => {
      md += `## Q${i + 1}. ${q.question}\n\n`;
      md += `**태그**: ${q.tag}\n\n`;
      md += `**모범답안**: ${q.model_answer}\n\n`;
      md += `**꼬리질문**: ${q.follow_up}\n\n`;
      if (q.terms?.length) {
        md += `**용어**:\n`;
        q.terms.forEach((t) => (md += `- ${t.term}: ${t.definition}\n`));
        md += "\n";
      }
      md += "---\n\n";
    });
    navigator.clipboard.writeText(md);
    alert("마크다운으로 복사했습니다. Notion에 붙여넣으세요.");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAdmin(false);
  }

  return (
    <main className="min-h-screen px-4 py-10 md:px-8 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-end justify-between border-b border-line pb-6">
          <div>
            <p className="font-mono text-xs tracking-widest text-amber uppercase mb-2">
              SSAFY 데이터 트랙 · CS 스터디
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ink">면접장</h1>
            <p className="mt-2 text-ink2 text-sm md:text-base">
              {isAdmin
                ? "관리자 모드 — 문제를 생성하고 등록할 수 있습니다."
                : "등록된 문제를 풀어보세요. 문제 생성은 관리자만 가능합니다."}
            </p>
          </div>
          <div className="shrink-0">
            {authChecked &&
              (isAdmin ? (
                <button
                  onClick={logout}
                  className="text-xs font-mono text-ink2 hover:text-ink border border-line rounded-md px-3 py-2"
                >
                  로그아웃
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="text-xs font-mono text-ink2 hover:text-ink border border-line rounded-md px-3 py-2"
                >
                  관리자 로그인
                </button>
              ))}
          </div>
        </header>

        {showLogin && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onSuccess={() => {
              setShowLogin(false);
              setIsAdmin(true);
            }}
          />
        )}

        {isAdmin && mode !== "interview" && (
          <section className="mb-8 rounded-lg border border-line bg-white/60 p-6 shadow-card">
            <p className="font-mono text-xs tracking-widest text-ink2 uppercase mb-3">1. 카테고리</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`text-left rounded-md border px-3 py-2 transition-colors ${
                    category === c.id
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-paper hover:border-brand/50 text-ink"
                  }`}
                >
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className={`text-xs mt-0.5 ${category === c.id ? "text-white/80" : "text-ink2"}`}>
                    {c.desc}
                  </div>
                </button>
              ))}
            </div>

            <p className="font-mono text-xs tracking-widest text-ink2 uppercase mb-3">2. 난이도</p>
            <div className="flex gap-2 mb-6">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                    difficulty === d.id
                      ? "border-amber bg-amber text-white"
                      : "border-line bg-paper hover:border-amber/50 text-ink"
                  }`}
                >
                  {d.label} <span className="opacity-70 text-xs">· {d.desc}</span>
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-[120px_1fr] gap-4 items-end">
              <div>
                <p className="font-mono text-xs tracking-widest text-ink2 uppercase mb-2">개수</p>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full rounded-md border border-line px-3 py-2 bg-paper text-ink"
                />
              </div>
              <div>
                <p className="font-mono text-xs tracking-widest text-ink2 uppercase mb-2">
                  추가 요청 (선택)
                </p>
                <input
                  type="text"
                  placeholder="예: 실무 사례 중심으로, 최근 이슈 반영해서"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="w-full rounded-md border border-line px-3 py-2 bg-paper text-ink placeholder:text-ink2/50"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={generate}
                disabled={loading}
                className="rounded-md bg-ink px-6 py-3 text-paper font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
              >
                {loading ? "생성 중…" : "문제 생성 및 등록"}
              </button>
              {error && <p className="text-sm text-red-700">{error}</p>}
            </div>
          </section>
        )}

        {mode === "browse" && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl text-ink">등록된 문제 은행</h2>
              <span className="text-xs font-mono text-ink2">{sets.length}개 세트</span>
            </div>

            {setsLoading && <p className="text-ink2 text-sm">불러오는 중…</p>}

            {!setsLoading && sets.length === 0 && (
              <div className="rounded-lg border border-dashed border-line p-10 text-center text-ink2">
                아직 등록된 문제가 없습니다.{" "}
                {isAdmin ? "위에서 첫 문제를 생성해보세요." : "관리자가 문제를 등록할 때까지 기다려주세요."}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              {sets.map((s) => (
                <div key={s.id} className="torn-top rounded-lg border border-line bg-white shadow-card p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-serif text-lg text-ink">{s.categoryLabel}</span>
                      <div className="text-xs text-ink2 font-mono mt-1">
                        {DIFFICULTIES.find((d) => d.id === s.difficulty)?.label} · {s.questions.length}
                        문제 · {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteSet(s.id)} className="text-xs text-red-700/70 hover:text-red-700">
                        삭제
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => openSet(s)}
                      className="flex-1 rounded-md border border-line px-3 py-2 text-sm text-ink hover:border-brand hover:text-brand transition-colors"
                    >
                      문제 보기
                    </button>
                    <button
                      onClick={() => startInterview(s)}
                      className="flex-1 rounded-md bg-ink px-3 py-2 text-sm text-paper hover:bg-brand-dark transition-colors"
                    >
                      모의면접
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {mode === "list" && current && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <button onClick={() => setMode("browse")} className="text-sm text-ink2 hover:text-ink mb-2 block">
                  ← 문제 은행으로
                </button>
                <h2 className="font-serif text-2xl text-ink">
                  {current.categoryLabel}{" "}
                  <span className="text-ink2 text-base font-sans">
                    · {DIFFICULTIES.find((d) => d.id === current.difficulty)?.label}
                  </span>
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startInterview(current)}
                  className="rounded-md border border-brand px-4 py-2 text-sm text-brand hover:bg-brand hover:text-white transition-colors"
                >
                  모의면접 모드
                </button>
                <button
                  onClick={() => exportMarkdown(current)}
                  className="rounded-md border border-line px-4 py-2 text-sm text-ink2 hover:border-ink transition-colors"
                >
                  MD로 복사
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {current.questions.map((q, i) => (
                <article key={i} className="torn-top rounded-lg border border-line bg-white shadow-card p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <span className="font-mono text-xs text-amber tracking-wide">
                      Q{String(i + 1).padStart(2, "0")} · {q.tag}
                    </span>
                  </div>
                  <p className="font-serif text-lg text-ink mb-4 leading-snug">{q.question}</p>
                  <AnswerReveal text={q.model_answer} />
                  <div className="mt-4 pt-4 border-t border-line/70">
                    <p className="text-xs font-mono text-ink2 uppercase tracking-wide mb-1">꼬리질문</p>
                    <p className="text-sm text-ink2">{q.follow_up}</p>
                  </div>
                  {q.terms?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {q.terms.map((t, ti) => (
                        <span
                          key={ti}
                          title={t.definition}
                          className="text-xs font-mono px-2 py-1 rounded bg-paper border border-line text-ink2 cursor-help"
                        >
                          {t.term}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {mode === "interview" && current && (
          <section className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => {
                  setMode("browse");
                  setTimerOn(false);
                }}
                className="text-sm text-ink2 hover:text-ink"
              >
                ← 문제 은행으로
              </button>
              <div className="font-mono text-2xl text-brand tabular-nums">{fmtTime(seconds)}</div>
            </div>

            <div className="text-center mb-2 font-mono text-xs text-ink2">
              {interviewIdx + 1} / {current.questions.length}
            </div>

            <article className="torn-top rounded-lg border border-line bg-white shadow-card p-8 text-center">
              <span className="font-mono text-xs text-amber tracking-wide">
                {current.questions[interviewIdx].tag}
              </span>
              <p className="font-serif text-2xl text-ink my-6 leading-relaxed">
                {current.questions[interviewIdx].question}
              </p>
              <div className="text-left mt-6">
                <AnswerReveal text={current.questions[interviewIdx].model_answer} label="밀어서 모범답안 확인" />
              </div>
            </article>

            <div className="mt-6 flex justify-center gap-3">
              <button
                disabled={interviewIdx === 0}
                onClick={() => setInterviewIdx((i) => i - 1)}
                className="rounded-md border border-line px-5 py-2 text-ink2 disabled:opacity-30"
              >
                이전
              </button>
              <button
                disabled={interviewIdx === current.questions.length - 1}
                onClick={() => setInterviewIdx((i) => i + 1)}
                className="rounded-md bg-ink px-5 py-2 text-paper disabled:opacity-30"
              >
                다음 질문
              </button>
            </div>
          </section>
        )}

        <footer className="mt-16 pt-6 border-t border-line text-center text-xs text-ink2 font-mono">
          Powered by Claude · SSAFY 18기 CS 스터디 자체 제작
        </footer>
      </div>
    </main>
  );
}
