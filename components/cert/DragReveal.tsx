"use client";

import { useRef, useState } from "react";

// app/page.tsx의 AnswerReveal과 같은 "밀어서 정답 확인" 가림막.
// 정답을 서버에서 받아와야 해서, 다 밀었을 때 onReveal을 부르고 내용은 children으로 받는다.
export function DragReveal({
  label = "밀어서 정답 확인",
  onReveal,
  children,
}: {
  label?: string;
  onReveal?: () => void;
  children: React.ReactNode;
}) {
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
      onReveal?.();
    }
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
    if (!revealed) setDragPct(100);
  };

  if (revealed) return <>{children}</>;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-md border border-line bg-white"
      style={{ minHeight: "3.2rem" }}
    >
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
