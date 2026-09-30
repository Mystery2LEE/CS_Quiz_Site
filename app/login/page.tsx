import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cert/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "로그인 — 면접장" };

// 같은 사이트 안의 경로만 허용한다
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/cert";
  return next;
}

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  if (currentUser()) redirect(next);

  return (
    <main className="min-h-screen px-4 py-10 flex items-center justify-center">
      <LoginForm next={next} />
    </main>
  );
}
