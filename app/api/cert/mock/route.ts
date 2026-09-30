import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/cert/session";
import { normalizeMockConfig, pickMock } from "@/lib/cert/mock";
import { getStats, saveDraft, type CertDraft } from "@/lib/cert/store";

export const runtime = "nodejs";

const MOCK_SID = "mock";

// 랜덤 모의고사 시작: 설정대로 문항을 뽑아 드래프트를 만든다. (한 번에 하나만 진행)
export async function POST(req: NextRequest) {
  const name = currentUser();
  if (!name) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const cfg = normalizeMockConfig(await req.json());
    const stats = cfg.excludeSolved ? await getStats(name) : {};
    const solved = new Set(Object.keys(stats).filter((id) => stats[id].tries > 0));
    const questions = pickMock(cfg, solved);
    if (questions.length === 0) {
      return NextResponse.json({ error: "출제할 문제가 없습니다." }, { status: 400 });
    }

    const now = Date.now();
    const draft: CertDraft = {
      sid: MOCK_SID,
      type: "mock",
      title: `랜덤 모의고사 (${questions.length}문항)`,
      qids: questions.map((q) => q.id),
      inputs: {},
      startedAt: now,
      endsAt: cfg.timerMin > 0 ? now + cfg.timerMin * 60 * 1000 : null,
    };
    await saveDraft(name, draft);
    return NextResponse.json({ ok: true, count: questions.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "출제 실패" }, { status: 500 });
  }
}
