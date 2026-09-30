import { notFound } from "next/navigation";
import { requireUser } from "@/lib/cert/session";
import { getQuestion, stripAnswer } from "@/lib/cert/data";
import { getStats } from "@/lib/cert/store";
import { Runner } from "@/components/cert/Runner";
import { MemoBox } from "@/components/cert/WrongNote";

// 단일 문제 + 해설 (검색 결과·오답노트 링크용)
export default async function QuestionPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const name = requireUser(`/cert/q/${encodeURIComponent(id)}`);
  const q = getQuestion(id);
  if (!q) notFound();

  const stat = (await getStats(name))[q.id];

  return (
    <div>
      <Runner
        mode="practice"
        questions={[stripAnswer(q)]}
        title={stripAnswer(q).source}
        backHref="/cert"
        backLabel="정처기 홈"
      />
      <div className="max-w-3xl mx-auto mt-8">
        <p className="text-xs font-mono text-ink2 mb-2">
          내 메모
          {stat && stat.tries > 0 ? ` · 시도 ${stat.tries}회 (정답 ${stat.correct} · 오답 ${stat.wrong})` : ""}
        </p>
        <MemoBox id={q.id} initial={stat?.memo ?? ""} />
      </div>
    </div>
  );
}
