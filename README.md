# 면접장 — CS 면접 문제 생성기

SSAFY 데이터 트랙 CS 스터디를 위한 AI 기반 면접 문제 생성 사이트입니다.
카테고리·난이도를 고르면 Claude가 실전 CS 면접 질문 + 모범답안 + 꼬리질문 + 용어정리를 만들어 줍니다.

## 기능

- 10개 카테고리(컴퓨터구조 / OS / 네트워크 / 자료구조 / DB / 데이터엔지니어링 / 분산시스템 / ML기초 / 보안 / SW공학) × 3단계 난이도
- 답안을 드래그로 밀어서 확인하는 방식 (기존 GeekNews PDF 포맷과 동일한 UX)
- 모의면접 모드: 질문만 보여주고 타이머 진행, 답안은 밀어서 확인
- 생성 결과를 Markdown으로 복사해 Notion에 바로 붙여넣기 가능
- 최근 생성 기록은 브라우저에 자동 저장 (localStorage)

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY 입력
npm run dev
```

http://localhost:3000 접속

## 배포 (Vercel, 무료)

1. 이 폴더를 GitHub 레포로 push
   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. [vercel.com](https://vercel.com) 접속 → GitHub 계정으로 로그인 → "Add New Project" → 방금 만든 레포 선택
3. Framework는 Next.js로 자동 감지됨. 별도 설정 없이 진행
4. **Environment Variables**에 아래 항목 추가
   - Key: `ANTHROPIC_API_KEY`
   - Value: Anthropic 콘솔(https://console.anthropic.com)에서 발급받은 API 키
5. Deploy 클릭 → 1~2분 후 `https://프로젝트명.vercel.app` 형태의 URL 발급됨
6. 이 URL을 스터디원들에게 공유하면 됩니다

## API 키 관련 주의사항

- API 키는 서버(Vercel 환경변수)에만 저장되고, 브라우저로는 절대 노출되지 않습니다 (API 라우트를 통해서만 호출).
- Claude API는 사용량 기반 과금입니다. 문제 1회 생성(질문 5개 기준) 비용은 매우 낮지만(수 원~수십 원 수준), 스터디원 전원이 자주 쓰면 누적됩니다. Anthropic 콘솔에서 사용량 한도(usage limit)를 걸어두는 것을 추천합니다.
- 공개 URL이므로 원치 않는 외부인이 API를 소모할 수 있습니다. 필요하면 간단한 접근 제한(예: 스터디원만 아는 URL 파라미터 체크, 또는 Vercel의 Password Protection 기능 - Pro 플랜)을 추가하는 것을 고려하세요.

## 폴더 구조

```
app/
  page.tsx              # 메인 UI
  layout.tsx            # 루트 레이아웃, 폰트/메타데이터
  globals.css           # 전역 스타일 (종이 질감, 드래그 리빌 카드)
  api/generate/route.ts # Claude API 호출 서버리스 함수
```

## 커스터마이징

- 카테고리 추가/수정: `app/api/generate/route.ts`의 `CATEGORY_LABELS`와 `app/page.tsx`의 `CATEGORIES` 둘 다 수정
- 생성 프롬프트 조정: `app/api/generate/route.ts`의 `systemPrompt` 수정
- 디자인 컬러: `tailwind.config.js`의 `theme.extend.colors`
