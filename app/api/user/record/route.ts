import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyUserCookie, USER_COOKIE_NAME } from "@/lib/auth";
import { getRedis, userHistoryKey, userWrongKey } from "@/lib/redis";

export const runtime = "nodejs";

export type AttemptEntry = {
  setId: string;
  category: string;
  categoryLabel: string;
  format: string;
  index: number;
  question: string;
  tag?: string;
  correct: boolean | null; // null = not auto-gradable (e.g. interview format)
  selfRated?: "known" | "unknown"; // for written/interview self-assessment
  selectedIndex?: number;
  correctIndex?: number;
  modelAnswer?: string;
  fullQuestion?: unknown; // full question payload, so it can be retried later
};

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(USER_COOKIE_NAME)?.value;
  const name = verifyUserCookie(cookie);
  if (!name) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { entries } = (await req.json()) as { entries: AttemptEntry[] };
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "저장할 항목이 없습니다." }, { status: 400 });
    }

    const redis = getRedis();
    const historyKey = userHistoryKey(name);
    const wrongKey = userWrongKey(name);

    for (const entry of entries) {
      const record = { ...entry, id: crypto.randomUUID(), ts: Date.now() };
      const json = JSON.stringify(record);
      await redis.lpush(historyKey, json);
      if (entry.correct === false || entry.selfRated === "unknown") {
        await redis.lpush(wrongKey, json);
      }
    }
    await redis.ltrim(historyKey, 0, 299);
    await redis.ltrim(wrongKey, 0, 199);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "저장 실패" }, { status: 500 });
  }
}
