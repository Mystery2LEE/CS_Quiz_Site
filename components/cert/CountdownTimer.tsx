"use client";

import { useEffect, useRef, useState } from "react";

// 마감 시각(endsAt) 기준 카운트다운. 새로고침해도 시간은 계속 흐르고, 0이 되면 onExpire를 한 번 부른다.
export function CountdownTimer({ endsAt, onExpire }: { endsAt: number; onExpire: () => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  if (left === null) return <div className="font-mono text-2xl text-brand tabular-nums">--:--:--</div>;

  const pad = (n: number) => n.toString().padStart(2, "0");
  const text = `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  return (
    <div
      className={`font-mono text-2xl tabular-nums ${left <= 300 ? "text-red-700" : "text-brand"}`}
      role="timer"
      aria-label="남은 시간"
    >
      {text}
    </div>
  );
}
