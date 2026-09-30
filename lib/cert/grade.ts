// 정보처리기사 실기 자동 채점 로직
// 규칙(시험 안내문 기준): 영문 대·소문자, 띄어쓰기는 구분하지 않음. 한글/영문 병기 답은 둘 중 하나만 써도 정답.
// 코드 실행 결과는 부분 점수 없음 → 출력 서식(쉼표 등)까지 일치해야 정답(공백 개수 차이만 허용).
import type { Answer, Blank, CertQuestion } from './types';

const JAMO_CIRCLED = '㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩㉪㉫㉬㉭';
const JAMO = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';
const CHAR_MAP: Record<string, string> = {
  '―': '-', '–': '-', '—': '-', '−': '-', '‐': '-',
  '×': 'x', '✕': 'x',
  '⋈': '▷◁', '∪': 'u', '∩': 'n',
  '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10',
  '‘': "'", '’': "'", '“': '"', '”': '"',
  '（': '(', '）': ')', '，': ',', '：': ':',
};

/** 단답 비교용 정규화: 소문자, 공백 제거, ㉠→ㄱ, 특수문자 통일, 끝 마침표 제거 */
export function normalizeShort(s: string): string {
  let out = '';
  for (const ch of s.trim()) {
    const i = JAMO_CIRCLED.indexOf(ch);
    out += i >= 0 ? JAMO[i] : (CHAR_MAP[ch] ?? ch);
  }
  return out
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\(\)$/, '')      // extend( ) → extend
    .replace(/[.。;]+$/, '');   // 끝 마침표·세미콜론
}

/** 코드 출력 비교용 정규화: 줄 끝 공백 제거, 연속 공백 1칸, 대소문자 구분 */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l, i, arr) => l !== '' || (i > 0 && i < arr.length - 1))
    .join('\n')
    .trim();
}

export interface BlankResult {
  label: string | null;
  input: string;
  correct: boolean;
  expected: string;   // 대표 정답
}

export interface GradeResult {
  mode: Answer['mode'];
  correct: boolean | null;   // essay는 null (Claude/자기 채점 필요)
  score: number;             // 획득 점수 (부분 점수 반영, essay는 0으로 두고 나중에 갱신)
  maxScore: number;
  blanks: BlankResult[];
  keywordHits?: { keyword: string; hit: boolean }[];  // essay 참고용
}

const splitList = (s: string) => s.split(/[,，]/).map(normalizeShort).filter(Boolean).sort().join('|');
const seqKey = (s: string) => normalizeShort(s).replace(/->|→|,/g, '');

function matchOne(input: string, blank: Blank): boolean {
  const n = normalizeShort(input);
  if (!n) return false;
  if (blank.set) return blank.accept.some((a) => splitList(a) === splitList(input));
  if (blank.seq) return blank.accept.some((a) => seqKey(a) === seqKey(input));
  return blank.accept.some((a) => normalizeShort(a) === n);
}

/**
 * inputs: 빈칸 순서대로 사용자가 입력한 답 (blanks.length 개). essay/output은 inputs[0] 하나.
 * 부분 점수: 빈칸이 여러 개인 단답형은 맞힌 비율만큼 (실제 시험의 부분 채점 흉내). output은 전부 아니면 0.
 */
export function grade(q: CertQuestion, inputs: string[]): GradeResult {
  const { answer, points } = q;

  if (answer.mode === 'essay') {
    const text = normalizeShort(inputs[0] ?? '');
    return {
      mode: 'essay', correct: null, score: 0, maxScore: points, blanks: [],
      keywordHits: (answer.keywords ?? []).map((k) => ({ keyword: k, hit: text.includes(normalizeShort(k)) })),
    };
  }

  if (answer.mode === 'output') {
    const expected = answer.blanks[0].accept[0];
    const ok = normalizeOutput(inputs[0] ?? '') === normalizeOutput(expected);
    return {
      mode: 'output', correct: ok, score: ok ? points : 0, maxScore: points,
      blanks: [{ label: null, input: inputs[0] ?? '', correct: ok, expected }],
    };
  }

  // short
  const blanks = answer.blanks;
  let results: BlankResult[];
  if (answer.ordered) {
    results = blanks.map((b, i) => ({
      label: b.label, input: inputs[i] ?? '', correct: matchOne(inputs[i] ?? '', b), expected: b.accept[0],
    }));
  } else {
    // 순서 무관: 입력 하나가 빈칸 하나에만 대응되도록 매칭
    const used = new Set<number>();
    results = inputs.slice(0, blanks.length).map((inp, i) => {
      const j = blanks.findIndex((b, k) => !used.has(k) && matchOne(inp, b));
      if (j >= 0) used.add(j);
      return { label: blanks[i]?.label ?? null, input: inp, correct: j >= 0, expected: blanks[j >= 0 ? j : i]?.accept[0] ?? '' };
    });
    while (results.length < blanks.length) {
      results.push({ label: null, input: '', correct: false, expected: blanks[results.length].accept[0] });
    }
  }
  const hit = results.filter((r) => r.correct).length;
  const all = hit === blanks.length;
  return {
    mode: 'short', correct: all,
    score: Math.round((points * hit) / blanks.length * 10) / 10,
    maxScore: points, blanks: results,
  };
}

/** 모의고사/회차 합격 판정: 100점 만점 환산 60점 이상 */
export function passResult(results: GradeResult[]) {
  const got = results.reduce((s, r) => s + r.score, 0);
  const max = results.reduce((s, r) => s + r.maxScore, 0) || 1;
  const score100 = Math.round((got / max) * 1000) / 10;
  return { got, max, score100, pass: score100 >= 60 };
}
