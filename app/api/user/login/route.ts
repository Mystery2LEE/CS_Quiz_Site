import { NextRequest, NextResponse } from "next/server";
import { hashPin, checkPin, makeSalt, makeUserCookie, USER_COOKIE_NAME } from "@/lib/auth";
import { getRedis, userKey } from "@/lib/redis";

export const runtime = "nodejs";

type StoredUser = { name: string; salt: string; pinHash: string; createdAt: number };

export async function POST(req: NextRequest) {
  try {
    const { name, pin } = await req.json();
    const cleanName = String(name || "").trim();

    if (!cleanName || cleanName.length > 20) {
      return NextResponse.json({ error: "이름은 1~20자로 입력해주세요." }, { status: 400 });
    }
    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      return NextResponse.json({ error: "PIN은 4~6자리 숫자로 입력해주세요." }, { status: 400 });
    }

    const redis = getRedis();
    const key = userKey(cleanName);
    const raw = await redis.get(key);
    const existing: StoredUser | null =
      typeof raw === "string" ? JSON.parse(raw) : (raw as StoredUser | null);

    if (existing) {
      if (!checkPin(String(pin), existing.salt, existing.pinHash)) {
        return NextResponse.json({ error: "PIN이 일치하지 않습니다." }, { status: 401 });
      }
    } else {
      const salt = makeSalt();
      const pinHash = hashPin(String(pin), salt);
      const record: StoredUser = { name: cleanName, salt, pinHash, createdAt: Date.now() };
      await redis.set(key, JSON.stringify(record));
    }

    const res = NextResponse.json({ ok: true, name: cleanName, isNew: !existing });
    res.cookies.set(USER_COOKIE_NAME, makeUserCookie(cleanName), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "로그인 실패" }, { status: 500 });
  }
}
