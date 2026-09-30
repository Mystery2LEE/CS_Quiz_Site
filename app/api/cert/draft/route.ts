import { NextRequest, NextResponse } from "next/server";
import { currentUser, cleanInputs } from "@/lib/cert/session";
import { bySet, getSet } from "@/lib/cert/data";
import { deleteDraft, getDraft, saveDraft, type CertDraft } from "@/lib/cert/store";
import { EXAM_MINUTES } from "@/lib/cert/public";

export const runtime = "nodejs";

const unauthorized = () => NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

// 회차 실전 모드 시작: { setId } → 150분 타이머가 걸린 드래프트를 만든다 (이미 있으면 그대로 이어간다)
export async function POST(req: NextRequest) {
  const name = currentUser();
  if (!name) return unauthorized();

  try {
    const { setId } = await req.json();
    const set = typeof setId === "string" ? getSet(setId) : undefined;
    if (!set || set.kind !== "exam") {
      return NextResponse.json({ error: "회차를 찾을 수 없습니다." }, { status: 404 });
    }

    const sid = `exam-${set.id}`;
    const existing = await getDraft(name, sid);
    if (existing) return NextResponse.json({ ok: true, sid });

    const now = Date.now();
    const draft: CertDraft = {
      sid,
      type: "exam",
      setId: set.id,
      title: set.title,
      qids: bySet(set.id).map((q) => q.id),
      inputs: {},
      startedAt: now,
      endsAt: now + EXAM_MINUTES * 60 * 1000,
    };
    await saveDraft(name, draft);
    return NextResponse.json({ ok: true, sid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "시작 실패" }, { status: 500 });
  }
}

// 답안 임시 저장: { sid, inputs: { qid: string[] } }
export async function PUT(req: NextRequest) {
  const name = currentUser();
  if (!name) return unauthorized();

  try {
    const { sid, inputs } = await req.json();
    const draft = typeof sid === "string" ? await getDraft(name, sid) : null;
    if (!draft) {
      return NextResponse.json({ error: "진행 중인 시험이 없습니다." }, { status: 404 });
    }

    const next: Record<string, string[]> = {};
    for (const id of draft.qids) {
      if (inputs && id in inputs) next[id] = cleanInputs(inputs[id]);
    }
    await saveDraft(name, { ...draft, inputs: next });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "저장 실패" }, { status: 500 });
  }
}

// 시험 포기: { sid }
export async function DELETE(req: NextRequest) {
  const name = currentUser();
  if (!name) return unauthorized();

  try {
    const { sid } = await req.json();
    if (typeof sid !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    await deleteDraft(name, sid);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "삭제 실패" }, { status: 500 });
  }
}
