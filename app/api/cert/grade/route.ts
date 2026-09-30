import { NextRequest, NextResponse } from "next/server";
import { currentUser, cleanInputs } from "@/lib/cert/session";
import { getQuestion } from "@/lib/cert/data";
import { judge, summarize, toItem } from "@/lib/cert/judge";
import { deleteDraft, getDraft, pushSession, recordAttempts, type CertSession } from "@/lib/cert/store";
import type { QResult } from "@/lib/cert/public";

export const runtime = "nodejs";

const MAX_ITEMS = 50;

// { items: [{ id, inputs }], sid? }
// sid가 있으면 실전/모의고사 제출: 드래프트의 문항 전체를 채점하고 세션으로 기록한다.
export async function POST(req: NextRequest) {
  const name = currentUser();
  if (!name) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const items = Array.isArray(body.items) ? (body.items as { id: string; inputs: unknown }[]) : [];
    const sid = typeof body.sid === "string" ? body.sid : null;

    const inputsById = new Map<string, string[]>();
    for (const it of items.slice(0, MAX_ITEMS)) {
      if (typeof it?.id === "string") inputsById.set(it.id, cleanInputs(it.inputs));
    }

    const draft = sid ? await getDraft(name, sid) : null;
    if (sid && !draft) {
      return NextResponse.json(
        { error: "진행 중인 시험을 찾을 수 없습니다. 이미 제출했거나 24시간이 지났습니다." },
        { status: 410 }
      );
    }

    const qids = draft ? draft.qids : [...inputsById.keys()];
    const results: QResult[] = [];
    const sessionItems = [];
    for (const id of qids) {
      const q = getQuestion(id);
      if (!q) continue;
      const r = judge(q, inputsById.get(id) ?? draft?.inputs[id] ?? []);
      results.push(r);
      sessionItems.push(toItem(q, r));
    }
    if (results.length === 0) {
      return NextResponse.json({ error: "채점할 문항이 없습니다." }, { status: 400 });
    }

    await recordAttempts(
      name,
      results.map((r) => ({ id: r.id, correct: r.correct, inputs: r.inputs }))
    );

    if (!draft) return NextResponse.json({ results });

    const endedAt = Date.now();
    const sessionId = `${draft.sid}:${endedAt}`;
    const summary = summarize(sessionId, sessionItems);
    const session: CertSession = {
      ...summary,
      id: sessionId,
      type: draft.type,
      ...(draft.setId ? { setId: draft.setId } : {}),
      title: draft.title,
      qids: results.map((r) => r.id),
      items: sessionItems,
      startedAt: draft.startedAt,
      endedAt,
    };
    await pushSession(name, session);
    await deleteDraft(name, draft.sid);

    return NextResponse.json({ results, summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "채점 실패" }, { status: 500 });
  }
}
