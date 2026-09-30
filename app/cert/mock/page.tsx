import { requireUser } from "@/lib/cert/session";
import { getQuestion, stripAnswer } from "@/lib/cert/data";
import { getDraft } from "@/lib/cert/store";
import type { CertQuestion } from "@/lib/cert/types";
import { Runner } from "@/components/cert/Runner";
import { MockSetup } from "@/components/cert/MockSetup";

export default async function MockPage() {
  const name = requireUser("/cert/mock");

  // 진행 중인 모의고사가 있으면 이어서 푼다
  const draft = await getDraft(name, "mock");
  if (draft) {
    const questions = draft.qids
      .map((id) => getQuestion(id))
      .filter((q): q is CertQuestion => !!q)
      .map(stripAnswer);
    return (
      <Runner
        key={draft.startedAt}
        mode="exam"
        questions={questions}
        title={draft.title}
        sid={draft.sid}
        endsAt={draft.endsAt}
        initialInputs={draft.inputs}
        backHref="/cert"
        backLabel="정처기 홈"
      />
    );
  }

  return <MockSetup />;
}
