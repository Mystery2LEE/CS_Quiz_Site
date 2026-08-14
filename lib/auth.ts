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

// ---- Simple per-user session (name + PIN) ----
// Not enterprise-grade auth. Good enough for a small study group:
// PIN is hashed+salted, session cookie is a self-verifying HMAC signature.

export const USER_COOKIE_NAME = "cs_quiz_user";

export function makeSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

export function checkPin(pin: string, salt: string, expectedHash: string): boolean {
  try {
    const computed = hashPin(pin, salt);
    const a = Buffer.from(computed);
    const b = Buffer.from(expectedHash);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function userSignature(name: string): string {
  return crypto.createHmac("sha256", getSecret()).update(`cs-quiz-user:${name}`).digest("hex");
}

export function makeUserCookie(name: string): string {
  return Buffer.from(JSON.stringify({ name, sig: userSignature(name) })).toString("base64");
}

export function verifyUserCookie(cookie: string | undefined | null): string | null {
  if (!cookie) return null;
  try {
    const { name, sig } = JSON.parse(Buffer.from(cookie, "base64").toString("utf8"));
    if (!name || !sig) return null;
    const expected = userSignature(name);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    return crypto.timingSafeEqual(a, b) ? name : null;
  } catch {
    return null;
  }
}
