import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/cert/session";
import { getQuestion } from "@/lib/cert/data";

export const runtime = "nodejs";

// 연습 모드 "밀어서 정답 확인": 채점 없이 정답·해설만 내려준다.
export async function POST(req: NextRequest) {
  const name = currentUser();
  if (!name) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await req.json().catch(() => ({ id: null }));
  const q = typeof id === "string" ? getQuestion(id) : undefined;
  if (!q) {
    return NextResponse.json({ error: "문항을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ answer: q.answer.display, explanation: q.explanation });
}
