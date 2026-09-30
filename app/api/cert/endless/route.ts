import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/cert/session";
import { stripAnswer } from "@/lib/cert/data";
import { normalizeEndlessFilter, pickEndless } from "@/lib/cert/endless";

export const runtime = "nodejs";

const MAX_COUNT = 20;
const MAX_EXCLUDE = 2000;

// { source, subject, count, exclude: string[] }
// 무한 풀기: 이번에 이미 나온 문제(exclude)를 빼고 무작위로 다음 묶음을 내려준다.
export async function POST(req: NextRequest) {
  const name = currentUser();
  if (!name) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const count = Math.min(MAX_COUNT, Math.max(1, Math.floor(Number(body?.count)) || 10));
    const exclude = new Set<string>(
      Array.isArray(body?.exclude)
        ? body.exclude.slice(0, MAX_EXCLUDE).filter((id: unknown) => typeof id === "string")
        : []
    );
    const { questions, cycled, poolSize } = pickEndless(normalizeEndlessFilter(body), exclude, count);
    return NextResponse.json({ questions: questions.map(stripAnswer), cycled, poolSize });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "출제 실패" }, { status: 500 });
  }
}
