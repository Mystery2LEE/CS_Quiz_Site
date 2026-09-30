"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/cert", label: "홈", match: (p: string) => p === "/cert" },
  {
    href: "/cert/exam",
    label: "회차별 기출",
    match: (p: string) => p.startsWith("/cert/exam") || p.startsWith("/cert/set"),
  },
  { href: "/cert/subject", label: "과목별", match: (p: string) => p.startsWith("/cert/subject") },
  { href: "/cert/mock", label: "랜덤 모의고사", match: (p: string) => p.startsWith("/cert/mock") },
  { href: "/cert/endless", label: "무한 풀기", match: (p: string) => p.startsWith("/cert/endless") },
  { href: "/cert/wrong", label: "오답노트", match: (p: string) => p.startsWith("/cert/wrong") },
  { href: "/cert/search", label: "검색", match: (p: string) => p.startsWith("/cert/search") },
];

export function CertNav() {
  const pathname = usePathname() || "";
  return (
    <nav className="flex flex-wrap gap-2">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`text-xs font-mono rounded-md border px-3 py-1.5 transition-colors ${
            l.match(pathname)
              ? "border-brand bg-brand text-white"
              : "border-line text-ink2 hover:border-brand/50"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
