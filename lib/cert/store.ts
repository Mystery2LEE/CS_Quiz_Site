// 정처기 문제은행 사용자별 Redis 저장소
//   cs-quiz:cert:{name}:q            HASH   qid → QStat
//   cs-quiz:cert:{name}:wrong        SET    오답노트 qid
//   cs-quiz:cert:{name}:sessions     LIST   CertSession (최근 50개)
//   cs-quiz:cert:{name}:draft:{sid}  STRING 진행 중인 실전/모의고사 (TTL 24h)
//   cs-quiz:cert:{name}:prefs        STRING 오답노트 설정
import { getRedis } from "@/lib/redis";
import type { SessionSummary } from "./public";
import type { SessionItem } from "./judge";

const qKey = (name: string) => `cs-quiz:cert:${name}:q`;
const wrongKey = (name: string) => `cs-quiz:cert:${name}:wrong`;
const sessionsKey = (name: string) => `cs-quiz:cert:${name}:sessions`;
const draftKey = (name: string, sid: string) => `cs-quiz:cert:${name}:draft:${sid}`;
const prefsKey = (name: string) => `cs-quiz:cert:${name}:prefs`;

const DRAFT_TTL = 60 * 60 * 24;
const MAX_SESSIONS = 50;

export interface QStat {
  tries: number;
  correct: number;
  wrong: number;
  streak: number;
  prevStreak: number; // 직전 시도 전의 streak — 판정을 고칠 때(정답으로 인정 등) 되돌리는 데 쓴다
  lastCorrect: boolean | null; // null = 서술형 자기 채점 대기
  lastAt: number;
  lastInput: string[];
  memo?: string;
}

export interface CertPrefs {
  graduateNow: boolean; // true면 한 번만 맞혀도 오답노트에서 제거
}

export interface CertSession extends SessionSummary {
  id: string;
  type: "exam" | "mock";
  setId?: string;
  title: string;
  qids: string[];
  items: SessionItem[];
  startedAt: number;
  endedAt: number;
}

export interface CertDraft {
  sid: string;
  type: "exam" | "mock";
  setId?: string;
  title: string;
  qids: string[];
  inputs: Record<string, string[]>;
  startedAt: number;
  endsAt: number | null; // 마감 시각(ms). null이면 타이머 없음
}

// Upstash 클라이언트는 JSON 문자열을 자동으로 파싱해 돌려주기도 한다 → 둘 다 받는다
function parse<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return raw as T;
}

const emptyStat = (): QStat => ({
  tries: 0, correct: 0, wrong: 0, streak: 0, prevStreak: 0, lastCorrect: null, lastAt: 0, lastInput: [],
});

export async function getStats(name: string): Promise<Record<string, QStat>> {
  const raw = (await getRedis().hgetall(qKey(name))) as Record<string, unknown> | null;
  const out: Record<string, QStat> = {};
  for (const [id, v] of Object.entries(raw ?? {})) {
    const s = parse<QStat>(v);
    if (s) out[id] = s;
  }
  return out;
}

async function getStat(name: string, id: string): Promise<QStat | null> {
  return parse<QStat>(await getRedis().hget(qKey(name), id));
}

export async function getWrongIds(name: string): Promise<string[]> {
  const raw = ((await getRedis().smembers(wrongKey(name))) || []) as unknown[];
  return raw.map(String);
}

export async function getPrefs(name: string): Promise<CertPrefs> {
  return parse<CertPrefs>(await getRedis().get(prefsKey(name))) ?? { graduateNow: false };
}

export async function setPrefs(name: string, prefs: CertPrefs): Promise<void> {
  await getRedis().set(prefsKey(name), JSON.stringify(prefs));
}

/** 틀리면 오답노트에 추가, 연속 2회(설정에 따라 1회) 맞히면 제거 */
async function syncWrong(name: string, changed: Record<string, QStat>): Promise<void> {
  const need = (await getPrefs(name)).graduateNow ? 1 : 2;
  const add: string[] = [];
  const rem: string[] = [];
  for (const [id, s] of Object.entries(changed)) {
    if (s.lastCorrect === false) add.push(id);
    else if (s.lastCorrect === true && s.streak >= need) rem.push(id);
  }
  const redis = getRedis();
  if (add.length) await redis.sadd(wrongKey(name), add[0], ...add.slice(1));
  if (rem.length) await redis.srem(wrongKey(name), ...rem);
}

export async function recordAttempts(
  name: string,
  attempts: { id: string; correct: boolean | null; inputs: string[] }[]
): Promise<void> {
  if (attempts.length === 0) return;
  const redis = getRedis();
  const raw = (await redis.hmget(qKey(name), ...attempts.map((a) => a.id))) as Record<string, unknown> | null;
  const changed: Record<string, QStat> = {};
  const now = Date.now();
  for (const a of attempts) {
    const s = parse<QStat>(raw?.[a.id]) ?? emptyStat();
    s.tries += 1;
    s.prevStreak = s.streak;
    if (a.correct === true) {
      s.correct += 1;
      s.streak += 1;
    } else if (a.correct === false) {
      s.wrong += 1;
      s.streak = 0;
    }
    s.lastCorrect = a.correct;
    s.lastAt = now;
    s.lastInput = a.inputs;
    changed[a.id] = s;
  }
  await redis.hset(qKey(name), changed);
  await syncWrong(name, changed);
}

/** 마지막 시도의 판정을 고친다 ("정답으로 인정", 서술형 자기 채점) */
export async function amendLast(name: string, id: string, correct: boolean): Promise<void> {
  const s = await getStat(name, id);
  if (!s || s.tries === 0) {
    await recordAttempts(name, [{ id, correct, inputs: [] }]);
    return;
  }
  if (s.lastCorrect === correct) return;
  if (s.lastCorrect === true) s.correct -= 1;
  if (s.lastCorrect === false) s.wrong -= 1;
  if (correct) {
    s.correct += 1;
    s.streak = (s.prevStreak ?? 0) + 1;
  } else {
    s.wrong += 1;
    s.streak = 0;
  }
  s.lastCorrect = correct;
  await getRedis().hset(qKey(name), { [id]: s });
  await syncWrong(name, { [id]: s });
}

export async function setMemo(name: string, id: string, memo: string): Promise<void> {
  const s = (await getStat(name, id)) ?? emptyStat();
  if (memo) s.memo = memo;
  else delete s.memo;
  await getRedis().hset(qKey(name), { [id]: s });
}

export async function removeWrong(name: string, id: string): Promise<void> {
  await getRedis().srem(wrongKey(name), id);
}

export async function getSessions(name: string): Promise<CertSession[]> {
  const raw = ((await getRedis().lrange(sessionsKey(name), 0, MAX_SESSIONS - 1)) || []) as unknown[];
  return raw.map((r) => parse<CertSession>(r)).filter((s): s is CertSession => !!s);
}

export async function pushSession(name: string, session: CertSession): Promise<void> {
  const redis = getRedis();
  await redis.lpush(sessionsKey(name), JSON.stringify(session));
  await redis.ltrim(sessionsKey(name), 0, MAX_SESSIONS - 1);
}

/** 세션 하나를 찾아 고쳐 쓴다. 없으면 null */
export async function updateSession(
  name: string,
  sessionId: string,
  update: (s: CertSession) => CertSession
): Promise<CertSession | null> {
  const sessions = await getSessions(name);
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) return null;
  const next = update(sessions[idx]);
  await getRedis().lset(sessionsKey(name), idx, JSON.stringify(next));
  return next;
}

export async function getDraft(name: string, sid: string): Promise<CertDraft | null> {
  return parse<CertDraft>(await getRedis().get(draftKey(name, sid)));
}

export async function saveDraft(name: string, draft: CertDraft): Promise<void> {
  await getRedis().set(draftKey(name, draft.sid), JSON.stringify(draft), { ex: DRAFT_TTL });
}

export async function deleteDraft(name: string, sid: string): Promise<void> {
  await getRedis().del(draftKey(name, sid));
}
