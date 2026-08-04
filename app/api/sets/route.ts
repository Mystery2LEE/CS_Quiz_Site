import { NextResponse } from "next/server";
import { getRedis, INDEX_KEY, setKey } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET() {
  try {
    const redis = getRedis();
    const ids = await redis.lrange<string>(INDEX_KEY, 0, 99);
    if (!ids || ids.length === 0) return NextResponse.json({ sets: [] });

    const raw = await Promise.all(ids.map((id) => redis.get(setKey(id))));
    const sets = raw.filter(Boolean);
    return NextResponse.json({ sets });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
