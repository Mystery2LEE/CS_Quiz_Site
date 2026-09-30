// 현재 로그인 사용자(이름) — 기존 이름+PIN 쿠키를 그대로 쓴다
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyUserCookie, USER_COOKIE_NAME } from "@/lib/auth";

export function currentUser(): string | null {
  return verifyUserCookie(cookies().get(USER_COOKIE_NAME)?.value);
}

/** /cert/* 페이지용: 비로그인이면 로그인 페이지로 보낸다 */
export function requireUser(next: string): string {
  const name = currentUser();
  if (!name) redirect(`/login?next=${encodeURIComponent(next)}`);
  return name;
}

/** 클라이언트가 보낸 답안 배열 정리 */
export function cleanInputs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((s) => String(s ?? "").slice(0, 4000));
}
