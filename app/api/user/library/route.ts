import { NextRequest, NextResponse } from "next/server";
import { verifyUserCookie, USER_COOKIE_NAME } from "@/lib/auth";
import { getRedis, userHistoryKey, userWrongKey } from "@/lib/redis";

export const runtime = "nodejs";

function parseAll(raw: unknown[]): any[] {
  return raw
    .map((item) => {
      if (typeof item === "string") {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      }
      return item;
    })
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(USER_COOKIE_NAME)?.value;
  const name = verifyUserCookie(cookie);
  if (!name) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const redis = getRedis();
    // 세트별 풀이 현황 계산에 쓰이므로 저장된 기록(최대 300개)을 모두 내려준다
    const rawHistory = (await redis.lrange(userHistoryKey(name), 0, 299)) || [];
    const rawWrong = (await redis.lrange(userWrongKey(name), 0, 99)) || [];
    return NextResponse.json({
      name,
      history: parseAll(rawHistory as unknown[]),
      wrong: parseAll(rawWrong as unknown[]),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "불러오기 실패" }, { status: 500 });
  }
}
