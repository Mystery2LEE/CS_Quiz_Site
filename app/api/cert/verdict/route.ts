import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/cert/session";
import { getQuestion } from "@/lib/cert/data";
import { summarize, verdictScore } from "@/lib/cert/judge";
import { amendLast, updateSession } from "@/lib/cert/store";

export const runtime = "nodejs";

// { id, verdict: 'full' | 'partial' | 'wrong', sessionId? }
// "정답으로 인정"(단답·실행결과 → full)과 서술형 자기 채점. sessionId가 있으면 그 회차 점수도 다시 계산한다.
export async function POST(req: NextRequest) {
  const name = currentUser();
  if (!name) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id, verdict, sessionId } = await req.json();
    const q = typeof id === "string" ? getQuestion(id) : undefined;
    if (!q) {
      return NextResponse.json({ error: "문항을 찾을 수 없습니다." }, { status: 404 });
    }
    if (verdict !== "full" && verdict !== "partial" && verdict !== "wrong") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    if (verdict === "partial" && q.answer.mode !== "essay") {
      return NextResponse.json({ error: "부분 점수는 서술형에만 줄 수 있습니다." }, { status: 400 });
    }

    const correct = verdict === "full";
    const score = verdictScore(q.points, verdict);
    await amendLast(name, q.id, correct);

    let summary = null;
    if (typeof sessionId === "string") {
      const session = await updateSession(name, sessionId, (s) => {
        const items = s.items.map((it) => (it.id === q.id ? { ...it, score, correct, verdict } : it));
        return { ...s, ...summarize(s.id, items), items };
      });
      if (session) summary = summarize(session.id, session.items);
    }

    return NextResponse.json({ ok: true, correct, score, verdict, summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "저장 실패" }, { status: 500 });
  }
}
