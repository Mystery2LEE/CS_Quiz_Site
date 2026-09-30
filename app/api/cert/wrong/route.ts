import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/cert/session";
import { getQuestion } from "@/lib/cert/data";
import { removeWrong, setMemo, setPrefs } from "@/lib/cert/store";

export const runtime = "nodejs";

const MEMO_MAX = 1000;

// 오답노트 관리
//   { action: 'memo', id, memo }      문항별 메모 저장 (빈 문자열이면 삭제)
//   { action: 'remove', id }          오답노트에서 제거
//   { action: 'prefs', graduateNow }  한 번만 맞혀도 바로 제거할지 설정
export async function POST(req: NextRequest) {
  const name = currentUser();
  if (!name) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (body.action === "prefs") {
      await setPrefs(name, { graduateNow: body.graduateNow === true });
      return NextResponse.json({ ok: true });
    }

    const q = typeof body.id === "string" ? getQuestion(body.id) : undefined;
    if (!q) {
      return NextResponse.json({ error: "문항을 찾을 수 없습니다." }, { status: 404 });
    }

    if (body.action === "memo") {
      await setMemo(name, q.id, String(body.memo ?? "").trim().slice(0, MEMO_MAX));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "remove") {
      await removeWrong(name, q.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "저장 실패" }, { status: 500 });
  }
}
