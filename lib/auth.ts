import crypto from "crypto";

const COOKIE_NAME = "cs_quiz_admin";

function getSecret(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD 환경변수가 설정되어 있지 않습니다.");
  return pw;
}

export function expectedToken(): string {
  return crypto.createHmac("sha256", getSecret()).update("cs-quiz-admin-session").digest("hex");
}

export function checkPassword(input: string): boolean {
  const secret = getSecret();
  const a = Buffer.from(input || "");
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const expected = expectedToken();
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export { COOKIE_NAME };
