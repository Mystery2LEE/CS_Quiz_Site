# 면접장 확장: 정보처리기사 실기 문제은행

> 이 파일을 Claude Code에 그대로 전달하세요. ("CLAUDE_CODE_TASK.md 읽고 구현해줘")

## 0. 목표

면접장(Next.js 14 App Router + Tailwind + Upstash Redis + Claude API)에 **정보처리기사 실기 문제은행**을 추가한다.
다른 문제은행 사이트처럼 **회차별 기출 / 과목별 / 랜덤 모의고사(타이머) / 오답노트·해설 / 검색**을 제공한다.
기존 CS 면접 퀴즈 기능은 건드리지 않는다.

## 1. 이 패키지에 들어 있는 것 (프로젝트 루트에 그대로 복사)

| 경로 | 내용 |
|---|---|
| `data/cert/questions.json` | 문제 591개 — 기출 20회분 398문항(2020년 1회 ~ 2026년 1회, 2020년 4·5회는 통합 1회분, 2024년 1회는 복원된 18문항) + 유형별 워크북 8종 193문항. 스키마는 `lib/cert/types.ts` (약 1.1MB → **서버에서만 import**, 클라이언트 번들에 넣지 말 것) |
| `data/cert/sets.json` | 과목 목록 + 세트(회차/워크북) 목록 |
| `public/cert/images/*.png` | 표·그림이 있는 문제의 원본 크롭 이미지 (105장) |
| `lib/cert/types.ts` | 타입 정의 — **수정하지 말고 그대로 사용** |
| `lib/cert/grade.ts` | 채점 로직 (검증 완료) — **그대로 사용** |
| `lib/cert/grade.test.mts` | 채점 테스트: `node --experimental-strip-types lib/cert/grade.test.mts` → `ALL PASS` |
| `scripts/cert-parser/` | PDF → JSON 변환기 (Python). 새 PDF 추가 시 사용 (README 참고) |

`tsconfig.json`에 `resolveJsonModule: true` 확인. 테스트 파일(`*.test.mts`)이 `next build` 타입체크에 걸리면 tsconfig `exclude`에 추가.

## 2. 먼저 할 일 (기존 코드 파악)

구현 전에 아래를 읽고 **기존 패턴을 그대로 따른다**.
1. 이름+PIN 로그인 / 세션에서 현재 사용자 ID를 얻는 방법
2. Redis 사용자별 저장 키 구조와 헬퍼 (기록·히스토리·오답 다시 풀기)
3. 서술형 **일괄(deferred batch) 채점** API와 Claude 호출부 → 정처기 서술형 채점에 재사용
4. 디자인 토큰: "면접 대기 번호표" 콘셉트, Pretendard bold, 형식별 색(indigo / mustard / teal), 카테고리 필터 칩, 드래그로 정답 보기
5. 모의면접 타이머 컴포넌트 → 모의고사 타이머에 재사용

## 3. 화면 / 라우트

모든 `/cert/*` 페이지는 **로그인 필수**(기출은 복원 문제이므로 스터디원 전용). 상단 내비에 `정처기 실기` 추가.

| 라우트 | 내용 |
|---|---|
| `/cert` | 허브. 카드 4개(회차별 기출·과목별·랜덤 모의고사·오답노트) + 내 진행률(전체/과목별 정답률, 최근 모의고사 점수) + 검색창 |
| `/cert/exam` | 회차 목록 (`sets.json`의 `kind:'exam'`, 연도·회차 내림차순, 연도별 그룹). 각 회차에 내 최고점/응시 횟수. 문항 수가 20이 아닌 회차(2024-1: 18문항)는 배지로 표시 |
| `/cert/exam/[setId]` | 회차 풀이. 시작 시 **실전 모드**(150분 타이머, 20문항 다 풀고 한 번에 제출 → 채점·합격판정) / **연습 모드**(문항마다 바로 채점·해설) 선택 |
| `/cert/set/[setId]` | 워크북 세트 풀이 (연습 모드). `topic`(소단원) 있으면 그룹 헤더로 표시 |
| `/cert/subject` | 과목 10개 칩 + 문항 수·내 정답률 |
| `/cert/subject/[subject]` | 과목별 풀이. 필터: 출처(기출/워크북), 언어(C/Java/Python), `안 푼 문제만`, `틀린 문제만`, 섞기 |
| `/cert/mock` | 랜덤 모의고사 설정 → 풀이. 기본 20문항: 프로그래밍 8(C·Java·Python 고르게), SQL 2, 나머지 10은 이론 과목에서 고르게. 출처 선택(기출만 / 전체, 기본 기출만). 이미 푼 문제 제외 옵션. 문항 수·과목 비율·타이머(기본 150분, 끄기 가능) 조정 가능. 제출 → 점수, 60점 이상 합격, 과목별 정답률 표 |
| `/cert/wrong` | 오답노트. 틀린 문제 목록(과목 필터), `다시 풀기`(오답만 모아 연습 모드), 문항별 메모. **연속 2회 맞히면 오답노트에서 졸업**(옵션: 바로 제거) |
| `/cert/q/[id]` | 단일 문제 + 해설 페이지 (검색 결과·오답노트 링크용) |
| `/cert/search?q=` | `prompt`·`body`·`answer.display`·`explanation` 전문 검색, 결과에 과목·출처 칩 |

## 4. 문제 카드 UI

- 헤더 칩: `2020년 1회 · 7번` / 과목 / 배점 / 형식
  - 형식 색은 기존 3색 재사용: `short`=빈칸/단답형 색, `output`=코드 실행결과(teal 계열), `essay`=서술형 색
- `prompt` 텍스트
- `image`가 있으면 **이미지를 보여주고 `body`는 숨김**(표·그림은 이미지가 정확함). 이미지 없으면 `body`를 `<pre class="whitespace-pre-wrap">`로 — 프로그래밍 문항(`lang` 있음)은 고정폭·어두운 코드 박스 + 언어 배지
- 입력:
  - `short`: `answer.blanks` 개수만큼 입력칸. `label` 있으면 칸 앞에 표시(①, 답, SQL, 팬인(Fan-In) …). `ordered:false`면 "순서 무관" 안내. `answer.note` 있으면 작게 표시
    - `blank.set`이면 칸 placeholder "쉼표로 구분해 모두 입력", `blank.seq`면 "순서대로 입력 (예: A → B → C)", `label==='SQL'`이면 고정폭 textarea
  - `output`: 고정폭 textarea ("출력 서식(공백·쉼표)까지 정확히")
  - `essay`: textarea
- 제출 후: 빈칸별 ✓/✗, 정답(`answer.display`), 해설(`explanation`, `<pre whitespace-pre-wrap>`, 접기/펼치기)
  - 연습 모드에서 정답은 기존 **드래그로 보기** 스타일도 지원
  - `short`/`output` 오답일 때 **"정답으로 인정"** 버튼(표기 차이 구제) → 정답으로 기록
  - `essay`: `answer.keywords` 칩(포함/미포함 표시) + **Claude 채점**(기존 일괄 채점 재사용) + 자기 채점 버튼(맞음/부분/틀림)

## 5. 채점 (서버에서)

- 실전/모의고사에서 답이 미리 노출되지 않도록 **채점은 API에서** 한다: `POST /api/cert/grade` `{ items: [{ id, inputs: string[] }] }` → `lib/cert/grade.ts`의 `grade()` 결과 + 해설 반환. 풀이 화면에 내려보내는 문제 데이터에서는 `answer`·`explanation`을 **빼고** 보낸다(빈칸 개수·label·ordered·note·mode만 전달)
- 서술형: `grade()`는 `correct:null` 반환 → 기존 일괄 채점 큐에 넣는다. 프롬프트에 문제, 모범답안(`answer.display`), 필수 표현(`answer.keywords`)을 넣고 `full / partial / wrong` + 한 줄 피드백을 받는다. 점수: full=배점, partial=배점의 절반, wrong=0. 채점 전까지 결과 화면에 "채점 중"
- 합격 판정은 `passResult()` 사용 (100점 환산 60점 이상)

## 6. Redis 저장 (기존 키 규칙에 맞춰 접두어만 조정)

```
cert:{userId}:q            HASH  qid → JSON { tries, correct, wrong, streak, lastCorrect, lastAt, lastInput, memo? }
cert:{userId}:wrong        SET   오답노트 qid (틀리면 추가, streak>=2 되면 제거)
cert:{userId}:sessions     LIST  JSON { type:'exam'|'mock'|'practice', setId?, qids, score100, pass, bySubject, startedAt, endedAt } (최근 50개 유지)
cert:{userId}:draft:{sid}  STRING 진행 중인 실전/모의고사 답안 + 남은 시간 (새로고침·이탈 복구, TTL 24h)
```
기존 "오답 다시 풀기"가 범용 구조면 그 구조에 합류해도 된다(판단해서 더 단순한 쪽).

## 7. 데이터 로딩

- 서버 컴포넌트/라우트에서만 `import questions from '@/data/cert/questions.json'` (약 1.1MB, 정적). 클라이언트에는 필요한 문항만 `stripAnswer()` 해서 props로 전달. `lib/cert/data.ts`에 조회 헬퍼: `getQuestion(id)`, `bySet(setId)`, `bySubject(subject)`, `search(q)`, `stripAnswer(q)`
- 과목 목록·세트 목록은 `sets.json`

## 8. 완료 조건

- [ ] `node --experimental-strip-types lib/cert/grade.test.mts` → ALL PASS
- [ ] `next build` 성공, 타입 에러 없음
- [ ] 2020년 1회 실전 모드: 20문항 풀고 제출 → 점수·합격 여부·과목별 표, 새로고침해도 답안·타이머 유지
- [ ] 과목별(`프로그래밍` + Java 필터) 풀이, 틀린 문제가 오답노트에 쌓이고 2연속 정답 시 빠짐
- [ ] 랜덤 모의고사 20문항이 비율대로 뽑히고 타이머 종료 시 자동 제출
- [ ] 서술형 제출 → Claude 채점 결과가 반영됨
- [ ] 이미지 문항(예: `wb01-007`, `2021-1-14`, `2023-1-19`)이 모바일 폭에서 가로 스크롤 없이 보임 (`max-w-full h-auto`)
- [ ] 비로그인 상태에서 `/cert/*` 접근 시 로그인으로 이동
- [ ] 기존 CS 퀴즈 기능 회귀 없음

## 9. 새 PDF 추가 (나중에)

`scripts/cert-parser/README.md` 참고. 요약:
```
cd scripts/cert-parser && pip install -r requirements.txt
python run_all.py <PDF 폴더> --out ../..
node --experimental-strip-types ../../lib/cert/grade.test.mts
```
출력된 경고(정답 비어 있음, 문항 수 20 아님)가 있으면 해당 문항을 확인하고 `build.py`의 `*_OVERRIDE`로 보정.
