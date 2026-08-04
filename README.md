# 면접장 — CS 면접 문제 생성기

SSAFY 데이터 트랙 CS 스터디를 위한 AI 기반 면접 문제 생성 사이트입니다.
**관리자(정현님)만 문제를 생성·등록**할 수 있고, **팀원은 등록된 문제를 조회하고 풀기**만 가능합니다.

## 기능

- 관리자 로그인 (비밀번호 기반, 서버 세션 쿠키)
- 관리자만 보이는 문제 생성 패널 — 10개 카테고리 × 3단계 난이도
- 생성된 문제는 공유 DB(Redis)에 저장되어 **모든 팀원이 같은 문제 은행을 봄**
- 답안은 드래그로 밀어서 확인 (기존 GeekNews PDF 포맷과 동일한 UX)
- 모의면접 모드: 질문만 보여주고 타이머 진행
- 관리자는 잘못 등록된 세트를 삭제 가능
- Markdown으로 복사해 Notion에 바로 붙여넣기 가능

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 아래 항목 채우기
npm run dev
```

## 배포 (Vercel, 무료)

### 1) GitHub push
이미 하셨다면 스킵.

### 2) Vercel 프로젝트 생성
Import 화면에서 지금 하신 대로 진행하되, **Deploy 누르기 전에 Environment Variables에 아래 항목 추가**:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic 콘솔(console.anthropic.com)에서 발급 |
| `ADMIN_PASSWORD` | 본인만 아는 비밀번호 직접 설정 (팀원에게 공유 X) |

### 3) 공유 저장소(Redis) 연결 — 배포 후 1회만
문제를 팀원 전체가 공유하려면 DB가 필요합니다. Vercel이 무료로 제공합니다.

1. 프로젝트 Deploy 완료 후, 프로젝트 대시보드 상단 **Storage** 탭 클릭
2. **Create Database** → **Redis** (Upstash 제공) 선택 → 무료 플랜으로 생성
3. 생성 후 뜨는 화면에서 **Connect to Project** → 방금 만든 프로젝트 선택 → Connect
   - 이 과정에서 `KV_REST_API_URL`, `KV_REST_API_TOKEN` 환경변수가 프로젝트에 자동으로 추가됩니다
4. 프로젝트 **Deployments** 탭 → 최신 배포 옆 `···` → **Redeploy** (환경변수가 반영되도록 재배포)

이제 `https://프로젝트명.vercel.app` 접속하면:
- 정현님: 우측 상단 "관리자 로그인" → 비밀번호 입력 → 문제 생성 패널이 나타남
- 팀원: 로그인 없이 접속 → "등록된 문제 은행"만 보임, 생성 버튼 없음

## API 키 관련 주의사항

- `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`는 서버에만 저장되고 브라우저에는 절대 노출되지 않습니다.
- 문제 생성 API(`/api/generate`)는 관리자 세션 쿠키가 없으면 403으로 막힙니다. 팀원 화면에는 생성 버튼 자체가 렌더링되지 않습니다.
- Claude API는 사용량 기반 과금입니다. 문제 1회 생성(질문 5개 기준) 비용은 낮은 편이지만(수십 원 수준), 관리자 로그인 자체가 막혀 있으므로 팀원이 API를 소모할 일은 없습니다. Anthropic 콘솔에서 usage limit을 걸어두면 더 안전합니다.
- Redis 무료 플랜(Upstash)은 일일 요청 수 제한이 있지만, 스터디 규모(4~6명)에서는 충분합니다.

## 폴더 구조

```
app/
  page.tsx                    # 메인 UI (관리자/팀원 뷰 분기)
  layout.tsx                  # 루트 레이아웃
  globals.css                 # 전역 스타일
  api/
    generate/route.ts         # 문제 생성 (관리자 전용) + Redis 저장
    sets/route.ts             # 등록된 문제 목록 조회 (공개)
    sets/[id]/route.ts        # 문제 세트 삭제 (관리자 전용)
    admin/login/route.ts      # 관리자 로그인
    admin/logout/route.ts     # 관리자 로그아웃
    admin/check/route.ts      # 세션 확인
lib/
  auth.ts                     # 비밀번호 검증, 세션 토큰 생성/검증
  redis.ts                    # Redis 클라이언트 래퍼
```

## 커스터마이징

- 카테고리 추가/수정: `app/api/generate/route.ts`의 `CATEGORY_LABELS`와 `app/page.tsx`의 `CATEGORIES` 둘 다 수정
- 생성 프롬프트 조정: `app/api/generate/route.ts`의 `systemPrompt`
- 관리자 비밀번호 변경: Vercel 환경변수 `ADMIN_PASSWORD` 수정 후 재배포 (기존 로그인 세션은 자동 무효화됨)
