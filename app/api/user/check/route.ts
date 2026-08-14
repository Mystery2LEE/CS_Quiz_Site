import { NextRequest, NextResponse } from "next/server";
import { verifyUserCookie, USER_COOKIE_NAME } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(USER_COOKIE_NAME)?.value;
  const name = verifyUserCookie(cookie);
  return NextResponse.json({ name });
}
