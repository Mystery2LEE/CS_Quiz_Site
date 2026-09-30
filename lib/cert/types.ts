// 정보처리기사 실기 문제은행 타입 정의
// 데이터: data/cert/questions.json, data/cert/sets.json (scripts/cert-parser 로 생성)

export type Subject =
  | '소프트웨어 설계' | '데이터베이스' | 'SQL' | '인터페이스·UI' | '테스트'
  | '보안' | '네트워크' | '운영체제' | '프로그래밍' | '패키징·신기술';

export type AnswerMode =
  | 'short'   // 단답형: 빈칸별 허용 답안 비교 (자동 채점)
  | 'output'  // 코드 실행 결과: 공백 정규화 후 정확히 일치 (자동 채점)
  | 'essay';  // 서술형: Claude 채점(기존 일괄 채점 재사용) 또는 자기 채점

export interface Blank {
  label: string | null;   // '①', '답', '팬인(Fan-In)' 등. null이면 라벨 없는 빈칸
  accept: string[];       // 허용 답안 (첫 번째가 대표 답)
  set?: boolean;          // 한 칸에 쉼표로 여러 개를 쓰는 답 (순서 무관, 전부 맞아야 정답). 예: 'DES, ARIA, SEED, AES'
  seq?: boolean;          // 순서 나열 답. 구분자(쉼표·화살표·공백) 무시하고 순서만 비교. 예: 'A → D → C → F'
}

export interface Answer {
  mode: AnswerMode;
  display: string;        // 해설 화면에 그대로 보여줄 정답 원문
  blanks: Blank[];        // essay는 빈 배열
  ordered: boolean;       // false면 순서 무관 (예: '3가지를 쓰시오', '모두 고르시오')
  keywords?: string[];    // essay: 반드시 포함돼야 하는 핵심 표현 (기출 PDF의 밑줄)
  note?: string;          // 예: '계산식은 채점하지 않고 최종 답만 채점합니다.'
}

export interface CertQuestion {
  id: string;             // 'kw-001', 'java-003', '2020-1-07'
  setId: string;          // sets.json 의 id ('2020-1', 'kw', 'java')
  number: number;         // 세트 내 문항 번호
  subject: Subject;
  lang: 'C' | 'Java' | 'Python' | null;  // 프로그래밍 문항의 언어
  topic: string | null;   // 워크북 소단원 (예: '클래스 기본')
  points: number;         // 기출 배점 (기본 5)
  prompt: string;         // 지시문
  body: string;           // 지문/코드/<보기> (공백·줄바꿈 보존 → <pre> 로 렌더)
  image: string | null;   // '/cert/images/xxx.png' — 있으면 body 대신 이미지를 보여줌
  answer: Answer;
  explanation: string;    // 해설 (공백·줄바꿈 보존)
}

export interface CertSet {
  id: string;
  kind: 'exam' | 'workbook';   // exam = 회차별 기출, workbook = 유형별 문제집
  title: string;
  year: number | null;
  session: number | null;      // 회차
  count: number;
}

export interface CertSetsFile {
  subjects: Subject[];
  sets: CertSet[];
}
