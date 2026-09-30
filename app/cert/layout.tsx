import type { Metadata } from "next";
import Link from "next/link";
import { CertNav } from "@/components/cert/CertNav";
import { currentUser } from "@/lib/cert/session";

export const metadata: Metadata = {
  title: "정처기 실기 문제은행 — 면접장",
  description: "정보처리기사 실기 기출·유형별 문제은행",
};

export default function CertLayout({ children }: { children: React.ReactNode }) {
  const name = currentUser();
  return (
    <main className="min-h-screen px-4 py-10 md:px-8 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b border-line pb-5">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <p className="font-mono text-xs tracking-widest text-amber uppercase mb-2">
                면접장 · 정보처리기사 실기
              </p>
              <Link href="/cert">
                <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink">정처기 실기 문제은행</h1>
              </Link>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {name && <span className="text-xs font-mono text-ink2 hidden sm:inline">{name}님</span>}
              <Link
                href="/"
                className="text-xs font-mono text-ink2 hover:text-ink border border-line rounded-md px-3 py-2"
              >
                ← 면접장
              </Link>
            </div>
          </div>
          <CertNav />
        </header>

        {children}

        <footer className="mt-16 pt-6 border-t border-line text-center text-xs text-ink2 font-mono">
          기출은 복원 문제입니다 · SSAFY CS 스터디 자체 제작
        </footer>
      </div>
    </main>
  );
}
