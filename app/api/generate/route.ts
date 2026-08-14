import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getRedis, INDEX_KEY, setKey } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 280;

const CATEGORY_LABELS: Record<string, string> = {
  "computer-architecture": "컴퓨터구조 (캐시, 메모리 계층, RISC/CISC 등)",
  "os": "운영체제 (프로세스/스레드, 스케줄링, 동기화, 메모리 관리)",
  "network": "네트워크 (OSI/TCP-IP, HTTP/HTTPS, TCP vs UDP, DNS)",
  "data-structure": "자료구조/알고리즘 이론 (트리, 그래프, 해시, 정렬, 시간복잡도)",
  "database": "데이터베이스 (모델링, 정규화, 인덱스, 트랜잭션, SQL)",
  "data-engineering": "데이터 엔지니어링 (ETL/ELT, Airflow, Spark, Kafka, 배치/스트리밍)",
  "distributed": "분산시스템 (샤딩, 복제, CAP 이론, 일관성 모델)",
  "ml-basics": "분석/ML 기초 (지도/비지도, 과적합, 평가지표, 피처엔지니어링)",
  "security": "보안/인증 (암호화, 해싱, OAuth, JWT, 세션)",
  "swe-general": "소프트웨어 공학/Git/API 설계",
};

const FORMAT_SCHEMAS: Record<string, string> = {
  interview: `{
  "questions": [
    {
      "question": "면접 질문 (한국어, 실제 면접에서 나올 법한 자연스러운 문장)",
      "model_answer": "모범 답안 (3~6문장, 구체적이고 실무 연결된 설명)",
      "follow_up": "꼬리질문 1개와 그에 대한 짧은 답변 방향",
      "terms": [{"term": "핵심 용어", "definition": "한 줄 정의"}],
      "tag": "질문 유형 태그 (예: 개념 확인, 비교 설명, 실무 적용, 트레이드오프)"
    }
  ]
}`,
  mcq: `{
  "questions": [
    {
      "question": "객관식 질문 (한 가지 정답이 명확히 존재해야 함)",
      "choices": ["보기1", "보기2", "보기3", "보기4"],
      "answer_index": 0,
      "explanation": "정답인 이유와 오답 보기들이 왜 틀렸는지에 대한 설명 (3~5문장)",
      "tag": "질문 유형 태그 (예: 개념 확인, 비교 구분, 계산)"
    }
  ]
}`,
  written: `{
  "questions": [
    {
      "question": "빈칸/단답형 질문. 문장 중간의 핵심 용어 자리를 ___(빈칸)으로 비우거나, '~을 가리키는 용어는?' 같이 한 단어~짧은 구절로 답할 수 있는 질문으로 만드세요.",
      "model_answer": "정답 (한 단어~짧은 구절, 1~4단어 이내로 짧게)",
      "key_points": ["정답과 함께 알아두면 좋은 관련 개념 1~2개 (짧은 구절)"],
      "tag": "질문 유형 태그 (예: 용어 정의, 빈칸 채우기, 개념 구분)"
    }
  ]
}`,
};

const FORMAT_LABELS: Record<string, string> = {
  interview: "면접형 (질문 + 모범답안 + 꼬리질문)",
  mcq: "객관식 (4지선다, 정답 1개)",
  written: "빈칸/단답형 (짧은 용어나 빈칸에 들어갈 말 맞히기)",
};

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!verifyToken(token)) {
    return NextResponse.json({ error: "관리자만 문제를 생성할 수 있습니다." }, { status: 403 });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다. Vercel 프로젝트 환경변수를 확인하세요." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { category, difficulty, count, focus, format } = body as {
      category: string;
      difficulty: string;
      count: number;
      focus?: string;
      format?: string;
    };

    if (!category || !CATEGORY_LABELS[category]) {
      return NextResponse.json({ error: "유효하지 않은 카테고리입니다." }, { status: 400 });
    }

    const fmt = format && FORMAT_SCHEMAS[format] ? format : "interview";

    const n = Math.min(Math.max(Number(count) || 5, 1), 10);
    const difficultyLabel =
      difficulty === "basic" ? "기초 (개념 정의 위주)" :
      difficulty === "advanced" ? "심화 (꼬리질문, 트레이드오프 위주)" :
      "중급 (실무 연결, 비교 설명 위주)";

    const anthropic = new Anthropic({ apiKey });

    const formatInstruction =
      fmt === "mcq"
        ? "형식: 객관식(4지선다). 보기는 반드시 4개, 정답은 1개만 존재해야 하며 나머지 보기는 그럴듯하지만 명확히 틀린 오답이어야 합니다. answer_index는 0부터 시작하는 정답 보기의 인덱스입니다."
        : fmt === "written"
        ? "형식: 빈칸/단답형. 문장 속 핵심 용어 자리를 빈칸(___)으로 비우거나 '~을 뜻하는 용어는?' 같은 짧은 질문으로 만드세요. model_answer는 반드시 한 단어~짧은 구절(1~4단어)이어야 하며, 긴 서술형 문장이 되어서는 안 됩니다."
        : "형식: 면접형. 실제 면접관이 구두로 물어볼 법한 자연스러운 질문으로 만드세요.";

    const systemPrompt = `당신은 한국 IT 기업 데이터 직군(데이터 엔지니어/분석가/ML) 채용 면접관 겸 CS 문제 출제자입니다.
SSAFY 교육생 스터디를 위한 CS 문제를 생성합니다.
${formatInstruction}
반드시 아래 JSON 스키마를 따르는 순수 JSON만 출력하세요. 마크다운 코드블록이나 설명 문장을 절대 포함하지 마세요.

스키마:
${FORMAT_SCHEMAS[fmt]}`;

    const hasMaterial = focus && focus.trim().length > 80;

    const userPrompt = hasMaterial
      ? `카테고리: ${CATEGORY_LABELS[category]}
난이도: ${difficultyLabel}
생성 개수: ${n}개

아래는 참고 자료(스터디 정리본, 아티클 등)입니다. 이 자료의 내용을 반드시 기반으로 삼아 문제를 만들어 주세요. 자료에 없는 내용을 지어내지 말고, 자료 안에서 다루는 개념·용어·사례를 정확히 반영하세요.

--- 참고 자료 시작 ---
${focus}
--- 참고 자료 끝 ---

위 자료를 바탕으로 CS 문제 ${n}개를 생성해 주세요. 질문끼리 겹치지 않게 자료의 여러 부분을 고르게 다루세요.`
      : `카테고리: ${CATEGORY_LABELS[category]}
난이도: ${difficultyLabel}
생성 개수: ${n}개
${focus ? `추가 요청사항: ${focus}` : ""}

위 조건에 맞는 CS 문제 ${n}개를 생성해 주세요. 질문끼리 겹치지 않게 다양한 세부 주제를 다루세요.`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: Math.min(1200 + n * 900, 8000),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("모델 응답에서 텍스트를 찾을 수 없습니다.");
    }

    if (msg.stop_reason === "max_tokens") {
      throw new Error(
        "생성 개수가 많아 응답이 중간에 잘렸습니다. 개수를 줄이거나(예: 5개 이하) 다시 시도해 주세요."
      );
    }

    let cleaned = textBlock.text.trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");

    const parsed = JSON.parse(cleaned);

    const id = crypto.randomUUID();
    const set = {
      id,
      createdAt: Date.now(),
      category,
      categoryLabel: CATEGORY_LABELS[category],
      difficulty,
      format: fmt,
      formatLabel: FORMAT_LABELS[fmt],
      questions: parsed.questions,
    };

    const redis = getRedis();
    await redis.set(setKey(id), JSON.stringify(set));
    await redis.lpush(INDEX_KEY, id);

    return NextResponse.json({ set });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "문제 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
