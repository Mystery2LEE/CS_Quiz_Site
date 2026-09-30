"use client";

import { useEffect, useRef, useState } from "react";

type Term = { term: string; definition: string };

type InterviewQuestion = {
  question: string;
  model_answer: string;
  follow_up: string;
  terms: Term[];
  tag: string;
};
type McqQuestion = {
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string;
  tag: string;
};
type WrittenQuestion = {
  question: string;
  model_answer: string;
  key_points: string[];
  tag: string;
};
type Question = InterviewQuestion & Partial<McqQuestion> & Partial<WrittenQuestion>;

type Format = "interview" | "mcq" | "written";

type QuestionSet = {
  id: string;
  createdAt: number;
  category: string;
  categoryLabel: string;
  difficulty: string;
  format: Format;
  formatLabel: string;
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

const FORMATS: { id: Format; label: string; desc: string }[] = [
  { id: "interview", label: "면접형", desc: "질문 + 모범답안 + 꼬리질문" },
  { id: "mcq", label: "객관식", desc: "4지선다, 클릭해서 정답 확인" },
  { id: "written", label: "빈칸/단답형", desc: "짧은 용어나 빈칸에 들어갈 말 맞히기" },
];

const FORMAT_STYLES: Record<Format, { badge: string; tab: string }> = {
  mcq: { badge: "bg-brand/10 text-brand border-brand/30", tab: "#4338CA" },
  written: { badge: "bg-amber/10 text-amber border-amber/30", tab: "#C08A22" },
  interview: { badge: "bg-teal/10 text-teal border-teal/30", tab: "#0F7A72" },
};

function FormatBadge({ format }: { format: Format }) {
  const label = FORMATS.find((f) => f.id === format)?.label || format;
  const style = FORMAT_STYLES[format];
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${style.badge}`}>{label}</span>
  );
}

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

type McqControlled = { selected: number | null; revealed: boolean; onSelect: (i: number) => void };
type AnswerControlled = {
  revealed: boolean;
  selfRated: "known" | "unknown" | null;
  onRate: (r: "known" | "unknown") => void;
};

function McqBody({ q, controlled }: { q: Question; controlled?: McqControlled }) {
  const [localSelected, setLocalSelected] = useState<number | null>(null);
  const selected = controlled ? controlled.selected : localSelected;
  const revealed = controlled ? controlled.revealed : selected !== null;
  const choices = q.choices || [];
  const correct = q.answer_index ?? -1;

  function pick(idx: number) {
    if (controlled) {
      if (controlled.revealed) return;
      controlled.onSelect(idx);
    } else {
      setLocalSelected(idx);
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {choices.map((c, idx) => {
          const isSelected = selected === idx;
          const isCorrect = idx === correct;
          let cls = "border-line bg-paper hover:border-brand/50";
          if (revealed && isCorrect) cls = "border-green-600 bg-green-50";
          else if (revealed && isSelected && !isCorrect) cls = "border-red-600 bg-red-50";
          else if (!revealed && isSelected) cls = "border-brand bg-brand/10";

          return (
            <button
              key={idx}
              onClick={() => pick(idx)}
              disabled={revealed}
              className={`w-full text-left rounded-md border px-4 py-2.5 text-sm text-ink transition-colors ${cls} disabled:cursor-default`}
            >
              <span className="font-mono text-xs text-ink2 mr-2">{String.fromCharCode(65 + idx)}</span>
              {c}
            </button>
          );
        })}
      </div>
      {revealed && selected !== null && (
        <div className="mt-4 pt-4 border-t border-line/70">
          <p className={`text-sm font-medium mb-1 ${selected === correct ? "text-green-700" : "text-red-700"}`}>
            {selected === correct ? "정답입니다" : `오답입니다 — 정답은 ${String.fromCharCode(65 + correct)}`}
          </p>
          <p className="text-sm text-ink2">{q.explanation}</p>
        </div>
      )}
      {controlled && !revealed && selected === null && (
        <p className="mt-3 text-xs text-ink2 font-mono">보기를 선택하세요. 채점은 마지막에 한번에 진행돼요.</p>
      )}
    </div>
  );
}

function SelfRateButtons({ controlled }: { controlled: AnswerControlled }) {
  return (
    <div className="mt-4 pt-4 border-t border-line/70 flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink2 font-mono">스스로 채점:</span>
      <button
        onClick={() => controlled.onRate("known")}
        className={`text-xs rounded-md border px-3 py-1.5 transition-colors ${
          controlled.selfRated === "known"
            ? "border-green-600 bg-green-50 text-green-700"
            : "border-line text-ink2 hover:border-green-600/60"
        }`}
      >
        알고 있었음
      </button>
      <button
        onClick={() => controlled.onRate("unknown")}
        className={`text-xs rounded-md border px-3 py-1.5 transition-colors ${
          controlled.selfRated === "unknown"
            ? "border-red-600 bg-red-50 text-red-700"
            : "border-line text-ink2 hover:border-red-600/60"
        }`}
      >
        몰랐음 (오답노트에 저장)
      </button>
    </div>
  );
}

function WrittenBody({ q, controlled }: { q: Question; controlled?: AnswerControlled }) {
  const [myAnswer, setMyAnswer] = useState("");
  const showAnswer = controlled ? controlled.revealed : true;

  return (
    <div>
      <input
        type="text"
        placeholder="빈칸에 들어갈 말을 적어보세요 (선택)"
        value={myAnswer}
        onChange={(e) => setMyAnswer(e.target.value)}
        className="w-full rounded-md border border-line px-3 py-2 bg-paper text-ink placeholder:text-ink2/50 mb-3"
      />
      {showAnswer ? (
        <>
          <AnswerReveal text={q.model_answer} label="밀어서 정답 확인" />
          {q.key_points && q.key_points.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line/70">
              <p className="text-xs font-mono text-ink2 uppercase tracking-wide mb-2">관련 개념</p>
              <ul className="space-y-1">
                {q.key_points.map((k, i) => (
                  <li key={i} className="text-sm text-ink2 flex gap-2">
                    <span className="text-amber">·</span>
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {controlled && <SelfRateButtons controlled={controlled} />}
        </>
      ) : (
        <p className="text-xs text-ink2 font-mono">채점하기를 누르면 정답을 확인할 수 있어요.</p>
      )}
    </div>
  );
}

function TermChip({ term, definition }: { term: string; definition: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-mono px-2 py-1 rounded bg-paper border border-line text-ink2 hover:border-brand/60 hover:text-brand transition-colors cursor-pointer"
      >
        {term}
      </button>
      {open && (
        <span className="absolute left-0 top-full mt-1.5 z-20 block w-56 rounded-md border border-line bg-white p-3 text-xs text-ink2 leading-relaxed shadow-card">
          {definition}
        </span>
      )}
    </span>
  );
}

function InterviewBody({ q, controlled }: { q: Question; controlled?: AnswerControlled }) {
  const showAnswer = controlled ? controlled.revealed : true;
  return (
    <div>
      {showAnswer ? (
        <>
          <AnswerReveal text={q.model_answer} />
          <div className="mt-4 pt-4 border-t border-line/70">
            <p className="text-xs font-mono text-ink2 uppercase tracking-wide mb-1">꼬리질문</p>
            <p className="text-sm text-ink2">{q.follow_up}</p>
          </div>
          {q.terms && q.terms.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {q.terms.map((t, ti) => (
                <TermChip key={ti} term={t.term} definition={t.definition} />
              ))}
            </div>
          )}
          {controlled && <SelfRateButtons controlled={controlled} />}
        </>
      ) : (
        <p className="text-xs text-ink2 font-mono">채점하기를 누르면 모범답안과 꼬리질문을 확인할 수 있어요.</p>
      )}
    </div>
  );
}

function QuestionCard({
  q,
  format,
  index,
  mcqControlled,
  answerControlled,
}: {
  q: Question;
  format: Format;
  index?: number;
  mcqControlled?: McqControlled;
  answerControlled?: AnswerControlled;
}) {
  return (
    <article
      className="torn-top rounded-lg border border-line bg-white shadow-card p-6"
      style={{ borderLeftWidth: 4, borderLeftColor: FORMAT_STYLES[format].tab }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className="font-mono text-xs text-ink2 tracking-wide flex items-center gap-2">
          {index !== undefined ? `Q${String(index + 1).padStart(2, "0")} · ` : ""}
          {q.tag}
        </span>
        <FormatBadge format={format} />
      </div>
      <p className="font-serif text-lg text-ink mb-4 leading-snug">{q.question}</p>
      {format === "mcq" && <McqBody q={q} controlled={mcqControlled} />}
      {format === "written" && <WrittenBody q={q} controlled={answerControlled} />}
      {format === "interview" && <InterviewBody q={q} controlled={answerControlled} />}
    </article>
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

function UserAuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
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
      onSuccess(data.name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-card p-6 w-full max-w-sm">
        <h3 className="font-serif text-xl text-ink mb-1">내 계정</h3>
        <p className="text-sm text-ink2 mb-4">
          이름과 PIN(숫자 4~6자리)을 입력하세요. 처음 쓰는 이름이면 자동으로 계정이 만들어져요.
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
            {loading ? "확인 중…" : "로그인 / 가입"}
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
  const [format, setFormat] = useState<Format>("interview");
  const [count, setCount] = useState(5);
  const [focus, setFocus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [current, setCurrent] = useState<QuestionSet | null>(null);
  const [browseFilter, setBrowseFilter] = useState<string>("all");

  const [mode, setMode] = useState<"browse" | "list" | "interview" | "library" | "retry">("browse");
  const [interviewIdx, setInterviewIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [timerOn, setTimerOn] = useState(false);

  // 한 문제씩 풀기: 답은 다 고른 뒤 "채점하기"를 눌러야 한번에 채점됨
  const [mcqAnswers, setMcqAnswers] = useState<(number | null)[]>([]);
  const [selfRatings, setSelfRatings] = useState<("known" | "unknown" | null)[]>([]);
  const [graded, setGraded] = useState(false);

  // 개인 계정 (이름 + PIN)
  const [userName, setUserName] = useState<string | null>(null);
  const [userChecked, setUserChecked] = useState(false);
  const [showUserAuth, setShowUserAuth] = useState(false);

  // 내 라이브러리
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryHistory, setLibraryHistory] = useState<any[]>([]);
  const [libraryWrong, setLibraryWrong] = useState<any[]>([]);
  const [libraryTab, setLibraryTab] = useState<"wrong" | "history">("wrong");

  // 오답노트 문제 다시 풀기
  const [retryEntry, setRetryEntry] = useState<any>(null);
  const [retrySelected, setRetrySelected] = useState<number | null>(null);
  const [retryGraded, setRetryGraded] = useState(false);
  const [retrySelfRated, setRetrySelfRated] = useState<"known" | "unknown" | null>(null);

  async function refreshAuth() {
    const res = await fetch("/api/admin/check");
    const data = await res.json();
    setIsAdmin(!!data.isAdmin);
    setAuthChecked(true);
  }

  async function refreshUser() {
    const res = await fetch("/api/user/check");
    const data = await res.json();
    setUserName(data.name || null);
    setUserChecked(true);
  }

  async function loadLibrary() {
    setLibraryLoading(true);
    try {
      const res = await fetch("/api/user/library");
      const data = await res.json();
      setLibraryHistory(data.history || []);
      setLibraryWrong(data.wrong || []);
    } finally {
      setLibraryLoading(false);
    }
  }

  async function userLogout() {
    await fetch("/api/user/logout", { method: "POST" });
    setUserName(null);
    if (mode === "library") setMode("browse");
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
    refreshUser();
  }, []);

  const filteredSets = browseFilter === "all" ? sets : sets.filter((s) => s.category === browseFilter);

  const mcqScore =
    current && current.format === "mcq"
      ? current.questions.reduce((acc, q, i) => acc + (mcqAnswers[i] === q.answer_index ? 1 : 0), 0)
      : 0;

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
        body: JSON.stringify({ category, difficulty, count, focus, format }),
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
    setMcqAnswers(new Array(set.questions.length).fill(null));
    setSelfRatings(new Array(set.questions.length).fill(null));
    setGraded(false);
  }

  function gradeInterview() {
    if (!current) return;
    setGraded(true);
    setTimerOn(false);

    if (current.format === "mcq" && userName) {
      const entries = current.questions.map((q, i) => ({
        setId: current.id,
        category: current.category,
        categoryLabel: current.categoryLabel,
        format: current.format,
        index: i,
        question: q.question,
        tag: q.tag,
        correct: mcqAnswers[i] !== null ? mcqAnswers[i] === q.answer_index : null,
        selectedIndex: mcqAnswers[i] ?? undefined,
        correctIndex: q.answer_index,
        fullQuestion: q,
      }));
      fetch("/api/user/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      }).catch(() => {});
    }
  }

  function updateSelfRating(idx: number, rating: "known" | "unknown") {
    setSelfRatings((prev) => {
      const next = [...prev];
      next[idx] = rating;
      return next;
    });
    if (!userName || !current) return;
    const q = current.questions[idx];
    const entry = {
      setId: current.id,
      category: current.category,
      categoryLabel: current.categoryLabel,
      format: current.format,
      index: idx,
      question: q.question,
      tag: q.tag,
      correct: null,
      selfRated: rating,
      modelAnswer: q.model_answer,
      fullQuestion: q,
    };
    fetch("/api/user/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [entry] }),
    }).catch(() => {});
  }

  async function deleteLibraryEntry(list: "history" | "wrong", id: string) {
    const res = await fetch("/api/user/entry", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list, id }),
    });
    if (res.ok) {
      if (list === "history") setLibraryHistory((prev) => prev.filter((e) => e.id !== id));
      else setLibraryWrong((prev) => prev.filter((e) => e.id !== id));
    }
  }

  function openRetry(entry: any) {
    setRetryEntry(entry);
    setRetrySelected(null);
    setRetryGraded(false);
    setRetrySelfRated(null);
    setMode("retry");
  }

  function gradeRetry() {
    if (!retryEntry) return;
    setRetryGraded(true);
    if (retryEntry.format === "mcq" && userName) {
      const q = retryEntry.fullQuestion;
      const entry = {
        setId: retryEntry.setId,
        category: retryEntry.category,
        categoryLabel: retryEntry.categoryLabel,
        format: retryEntry.format,
        index: retryEntry.index,
        question: q.question,
        tag: q.tag,
        correct: retrySelected !== null ? retrySelected === q.answer_index : null,
        selectedIndex: retrySelected ?? undefined,
        correctIndex: q.answer_index,
        fullQuestion: q,
      };
      fetch("/api/user/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [entry] }),
      }).catch(() => {});
    }
  }

  function rateRetry(rating: "known" | "unknown") {
    setRetrySelfRated(rating);
    if (!retryEntry || !userName) return;
    const q = retryEntry.fullQuestion;
    const entry = {
      setId: retryEntry.setId,
      category: retryEntry.category,
      categoryLabel: retryEntry.categoryLabel,
      format: retryEntry.format,
      index: retryEntry.index,
      question: q.question,
      tag: q.tag,
      correct: null,
      selfRated: rating,
      modelAnswer: q.model_answer,
      fullQuestion: q,
    };
    fetch("/api/user/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [entry] }),
    }).catch(() => {});
  }


  function exportMarkdown(set: QuestionSet) {
    let md = `# ${set.categoryLabel} 문제 (${set.formatLabel} · ${set.difficulty})\n\n`;
    set.questions.forEach((q, i) => {
      md += `## Q${i + 1}. ${q.question}\n\n`;
      md += `**태그**: ${q.tag}\n\n`;
      if (set.format === "mcq") {
        (q.choices || []).forEach((c, ci) => {
          md += `- ${String.fromCharCode(65 + ci)}. ${c}${ci === q.answer_index ? " ✅" : ""}\n`;
        });
        md += `\n**해설**: ${q.explanation}\n\n`;
      } else {
        md += `**모범답안**: ${q.model_answer}\n\n`;
        if (set.format === "interview") {
          md += `**꼬리질문**: ${q.follow_up}\n\n`;
          if (q.terms?.length) {
            md += `**용어**:\n`;
            q.terms.forEach((t) => (md += `- ${t.term}: ${t.definition}\n`));
            md += "\n";
          }
        }
        if (set.format === "written" && q.key_points?.length) {
          md += `**채점 포인트**:\n`;
          q.key_points.forEach((k) => (md += `- ${k}\n`));
          md += "\n";
        }
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
          <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
            <a
              href="/cert"
              className="text-xs font-mono text-brand hover:text-brand-dark border border-brand/40 rounded-md px-3 py-2"
            >
              정처기 실기
            </a>
            {userChecked &&
              (userName ? (
                <>
                  <button
                    onClick={() => {
                      setMode("library");
                      loadLibrary();
                    }}
                    className="text-xs font-mono text-ink2 hover:text-ink border border-line rounded-md px-3 py-2"
                  >
                    {userName}님의 라이브러리
                  </button>
                  <button
                    onClick={userLogout}
                    className="text-xs font-mono text-ink2 hover:text-ink border border-line rounded-md px-3 py-2"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowUserAuth(true)}
                  className="text-xs font-mono text-ink2 hover:text-ink border border-line rounded-md px-3 py-2"
                >
                  로그인
                </button>
              ))}
            {authChecked &&
              (isAdmin ? (
                <button
                  onClick={logout}
                  className="text-xs font-mono text-ink2 hover:text-ink border border-line rounded-md px-3 py-2"
                >
                  관리자 로그아웃
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

        {showUserAuth && (
          <UserAuthModal
            onClose={() => setShowUserAuth(false)}
            onSuccess={(name) => {
              setShowUserAuth(false);
              setUserName(name);
            }}
          />
        )}

        {isAdmin && mode !== "interview" && mode !== "library" && mode !== "retry" && (
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

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="font-mono text-xs tracking-widest text-ink2 uppercase mb-3">2. 난이도</p>
                <div className="flex flex-wrap gap-2">
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
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-xs tracking-widest text-ink2 uppercase mb-3">3. 형식</p>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      title={f.desc}
                      className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                        format === f.id
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-paper hover:border-brand/50 text-ink"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-[120px_1fr] gap-4">
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
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono text-xs tracking-widest text-ink2 uppercase">
                    참고 자료 / 추가 요청 (선택)
                  </p>
                  {focus.trim().length > 80 && (
                    <span className="text-xs text-brand font-mono">이 내용을 기반으로 생성됨</span>
                  )}
                </div>
                <textarea
                  placeholder="짧은 요청: 예) 실무 사례 중심으로&#10;&#10;또는 정리본·아티클 텍스트를 통째로 붙여넣으면, 그 내용을 기반으로 질문을 만듭니다."
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-line px-3 py-2 bg-paper text-ink placeholder:text-ink2/50 resize-y"
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
              <span className="text-xs font-mono text-ink2">{filteredSets.length}개 세트</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setBrowseFilter("all")}
                className={`text-xs font-mono rounded-md border px-3 py-1.5 transition-colors ${
                  browseFilter === "all"
                    ? "border-brand bg-brand text-white"
                    : "border-line text-ink2 hover:border-brand/50"
                }`}
              >
                전체
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setBrowseFilter(c.id)}
                  className={`text-xs font-mono rounded-md border px-3 py-1.5 transition-colors ${
                    browseFilter === c.id
                      ? "border-brand bg-brand text-white"
                      : "border-line text-ink2 hover:border-brand/50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {setsLoading && <p className="text-ink2 text-sm">불러오는 중…</p>}

            {!setsLoading && filteredSets.length === 0 && (
              <div className="rounded-lg border border-dashed border-line p-10 text-center text-ink2">
                {sets.length === 0
                  ? isAdmin
                    ? "아직 등록된 문제가 없습니다. 위에서 첫 문제를 생성해보세요."
                    : "아직 등록된 문제가 없습니다. 관리자가 문제를 등록할 때까지 기다려주세요."
                  : "이 목차에는 아직 등록된 문제가 없습니다."}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              {filteredSets.map((s) => (
                <div
                  key={s.id}
                  className="torn-top rounded-lg border border-line bg-white shadow-card p-5"
                  style={{ borderLeftWidth: 4, borderLeftColor: FORMAT_STYLES[s.format].tab }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-lg text-ink">{s.categoryLabel}</span>
                        <FormatBadge format={s.format} />
                      </div>
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
                      한 문제씩 풀기
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
                    · {FORMATS.find((f) => f.id === current.format)?.label} ·{" "}
                    {DIFFICULTIES.find((d) => d.id === current.difficulty)?.label}
                  </span>
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startInterview(current)}
                  className="rounded-md border border-brand px-4 py-2 text-sm text-brand hover:bg-brand hover:text-white transition-colors"
                >
                  한 문제씩 풀기
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
                <QuestionCard key={i} q={q} format={current.format} index={i} />
              ))}
            </div>
          </section>
        )}

        {mode === "library" && (
          <section>
            <button onClick={() => setMode("browse")} className="text-sm text-ink2 hover:text-ink mb-4 block">
              ← 문제 은행으로
            </button>
            <h2 className="font-serif text-2xl text-ink mb-4">{userName}님의 라이브러리</h2>

            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setLibraryTab("wrong")}
                className={`text-sm rounded-md border px-4 py-2 transition-colors ${
                  libraryTab === "wrong"
                    ? "border-brand bg-brand text-white"
                    : "border-line text-ink2 hover:border-brand/50"
                }`}
              >
                오답노트 ({libraryWrong.length})
              </button>
              <button
                onClick={() => setLibraryTab("history")}
                className={`text-sm rounded-md border px-4 py-2 transition-colors ${
                  libraryTab === "history"
                    ? "border-brand bg-brand text-white"
                    : "border-line text-ink2 hover:border-brand/50"
                }`}
              >
                전체 기록 ({libraryHistory.length})
              </button>
            </div>

            {libraryLoading && <p className="text-ink2 text-sm">불러오는 중…</p>}

            {!libraryLoading && (
              <div className="space-y-3">
                {(libraryTab === "wrong" ? libraryWrong : libraryHistory).length === 0 && (
                  <div className="rounded-lg border border-dashed border-line p-10 text-center text-ink2">
                    {libraryTab === "wrong" ? "아직 오답노트가 비어있어요." : "아직 푼 문제 기록이 없어요."}
                  </div>
                )}
                {(libraryTab === "wrong" ? libraryWrong : libraryHistory).map((e) => (
                  <div
                    key={e.id ?? `${e.ts}-${e.question}`}
                    className="torn-top rounded-lg border border-line bg-white shadow-card p-4"
                    style={{ borderLeftWidth: 4, borderLeftColor: FORMAT_STYLES[e.format as Format]?.tab }}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="flex items-center gap-2">
                        <FormatBadge format={e.format} />
                        <span className="text-xs font-mono text-ink2">
                          {e.categoryLabel} · {e.tag}
                        </span>
                      </span>
                      <span className="text-[10px] font-mono text-ink2 shrink-0">
                        {e.ts ? new Date(e.ts).toLocaleString("ko-KR") : ""}
                      </span>
                    </div>
                    <p className="text-sm text-ink mb-2 leading-snug">{e.question}</p>
                    {e.format === "mcq" ? (
                      <p className={`text-xs font-mono ${e.correct ? "text-green-700" : "text-red-700"}`}>
                        {e.correct ? "정답" : "오답"}
                        {typeof e.correctIndex === "number"
                          ? ` · 정답: ${String.fromCharCode(65 + e.correctIndex)}`
                          : ""}
                      </p>
                    ) : (
                      <p
                        className={`text-xs font-mono ${
                          e.selfRated === "known" ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {e.selfRated === "known" ? "알고 있었음" : "몰랐음"}
                      </p>
                    )}
                    <div className="mt-3 pt-3 border-t border-line/70 flex items-center gap-2">
                      {libraryTab === "wrong" && e.fullQuestion && (
                        <button
                          onClick={() => openRetry(e)}
                          className="text-xs rounded-md border border-brand text-brand px-3 py-1.5 hover:bg-brand hover:text-white transition-colors"
                        >
                          다시 풀기
                        </button>
                      )}
                      <button
                        onClick={() => e.id && deleteLibraryEntry(libraryTab, e.id)}
                        className="text-xs rounded-md border border-line text-ink2 px-3 py-1.5 hover:border-red-600/60 hover:text-red-700 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {mode === "retry" && retryEntry && (
          <section className="max-w-2xl mx-auto">
            <button
              onClick={() => {
                setMode("library");
                setRetryEntry(null);
              }}
              className="text-sm text-ink2 hover:text-ink mb-6 block"
            >
              ← 라이브러리로
            </button>

            <div className="mb-4 flex items-center gap-2">
              <FormatBadge format={retryEntry.format} />
              <span className="text-xs font-mono text-ink2">
                {retryEntry.categoryLabel} · 오답노트 다시 풀기
              </span>
            </div>

            <QuestionCard
              q={retryEntry.fullQuestion}
              format={retryEntry.format}
              mcqControlled={
                retryEntry.format === "mcq"
                  ? { selected: retrySelected, revealed: retryGraded, onSelect: setRetrySelected }
                  : undefined
              }
              answerControlled={
                retryEntry.format !== "mcq"
                  ? { revealed: retryGraded, selfRated: retrySelfRated, onRate: rateRetry }
                  : undefined
              }
            />

            <div className="mt-6 flex justify-center gap-3">
              {!retryGraded ? (
                <button
                  onClick={retryEntry.format === "mcq" ? gradeRetry : () => setRetryGraded(true)}
                  className="rounded-md bg-brand px-5 py-2 text-white hover:bg-brand-dark transition-colors"
                >
                  {retryEntry.format === "mcq" ? "채점하기" : "정답 확인하기"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setRetrySelected(null);
                    setRetryGraded(false);
                    setRetrySelfRated(null);
                  }}
                  className="rounded-md border border-brand px-5 py-2 text-brand hover:bg-brand hover:text-white transition-colors"
                >
                  다시 풀기
                </button>
              )}
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

            {graded && current.format === "mcq" && (
              <div className="mb-4 rounded-lg border border-brand/40 bg-brand/5 px-4 py-3 text-center">
                <span className="font-mono text-sm text-brand">
                  채점 완료 — {mcqScore} / {current.questions.length}점 (
                  {Math.round((mcqScore / current.questions.length) * 100)}%)
                </span>
              </div>
            )}

            <QuestionCard
              key={interviewIdx}
              q={current.questions[interviewIdx]}
              format={current.format}
              mcqControlled={
                current.format === "mcq"
                  ? {
                      selected: mcqAnswers[interviewIdx] ?? null,
                      revealed: graded,
                      onSelect: (i) =>
                        setMcqAnswers((prev) => {
                          const next = [...prev];
                          next[interviewIdx] = i;
                          return next;
                        }),
                    }
                  : undefined
              }
              answerControlled={
                current.format !== "mcq"
                  ? {
                      revealed: graded,
                      selfRated: selfRatings[interviewIdx] ?? null,
                      onRate: (r) => updateSelfRating(interviewIdx, r),
                    }
                  : undefined
              }
            />

            <div className="mt-6 flex justify-center items-center gap-3">
              <button
                disabled={interviewIdx === 0}
                onClick={() => setInterviewIdx((i) => i - 1)}
                className="rounded-md border border-line px-5 py-2 text-ink2 disabled:opacity-30"
              >
                이전
              </button>
              {!graded ? (
                <button
                  onClick={gradeInterview}
                  className="rounded-md bg-brand px-5 py-2 text-white hover:bg-brand-dark transition-colors"
                >
                  채점하기
                </button>
              ) : (
                <button
                  onClick={() => startInterview(current)}
                  className="rounded-md border border-brand px-5 py-2 text-brand hover:bg-brand hover:text-white transition-colors"
                >
                  다시 풀기
                </button>
              )}
              <button
                disabled={interviewIdx === current.questions.length - 1}
                onClick={() => setInterviewIdx((i) => i + 1)}
                className="rounded-md bg-ink px-5 py-2 text-paper disabled:opacity-30"
              >
                다음 질문
              </button>
            </div>
            {!userName && (
              <p className="text-center text-xs text-ink2 font-mono mt-4">
                로그인하면 채점 결과가 내 라이브러리(오답노트)에 자동 저장돼요.
              </p>
            )}
          </section>
        )}

        <footer className="mt-16 pt-6 border-t border-line text-center text-xs text-ink2 font-mono">
          Powered by Claude · SSAFY CS 스터디 자체 제작
        </footer>
      </div>
    </main>
  );
}
