import { notFound } from "next/navigation";
import { requireUser } from "@/lib/cert/session";
import { bySet, getSet, stripAnswer } from "@/lib/cert/data";
import { getDraft } from "@/lib/cert/store";
import { Runner } from "@/components/cert/Runner";
import { ExamStart } from "@/components/cert/ExamStart";

export default async function ExamPage({
  params,
  searchParams,
}: {
  params: { setId: string };
  searchParams: { mode?: string };
}) {
  const name = requireUser(`/cert/exam/${params.setId}`);
  const set = getSet(params.setId);
  if (!set || set.kind !== "exam") notFound();

  const questions = bySet(set.id).map(stripAnswer);
  const back = { backHref: "/cert/exam", backLabel: "회차 목록" };

  // 진행 중인 실전 모드가 있으면 이어서 푼다 (답안·타이머 복구)
  const draft = await getDraft(name, `exam-${set.id}`);
  if (draft) {
    return (
      <Runner
        key={draft.startedAt}
        mode="exam"
        questions={questions}
        title={`${set.title} · 실전`}
        sid={draft.sid}
        endsAt={draft.endsAt}
        initialInputs={draft.inputs}
        {...back}
      />
    );
  }

  if (searchParams.mode === "practice") {
    return <Runner mode="practice" questions={questions} title={`${set.title} · 연습`} {...back} />;
  }

  return <ExamStart setId={set.id} title={set.title} count={set.count} />;
}
