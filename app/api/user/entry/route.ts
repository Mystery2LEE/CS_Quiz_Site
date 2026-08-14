import { NextRequest, NextResponse } from "next/server";
import { verifyUserCookie, USER_COOKIE_NAME } from "@/lib/auth";
import { getRedis, userHistoryKey, userWrongKey } from "@/lib/redis";

export const runtime = "nodejs";

async function removeEntry(key: string, id: string): Promise<boolean> {
  const redis = getRedis();
  const raw = ((await redis.lrange(key, 0, -1)) || []) as unknown[];
  const parsed = raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r)) as any[];
  const filtered = parsed.filter((e) => e?.id !== id);
  if (filtered.length === parsed.length) return false;

  await redis.del(key);
  if (filtered.length > 0) {
    await redis.rpush(key, ...filtered.map((e) => JSON.stringify(e)));
  }
  return true;
}

export async function DELETE(req: NextRequest) {
  const cookie = req.cookies.get(USER_COOKIE_NAME)?.value;
  const name = verifyUserCookie(cookie);
  if (!name) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { list, id } = await req.json();
    if (list !== "history" && list !== "wrong") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }

    const key = list === "history" ? userHistoryKey(name) : userWrongKey(name);
    const ok = await removeEntry(key, id);
    return NextResponse.json({ ok });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "삭제 실패" }, { status: 500 });
  }
}
