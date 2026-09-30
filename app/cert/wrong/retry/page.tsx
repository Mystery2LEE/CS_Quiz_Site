import { requireUser } from "@/lib/cert/session";
import { getQuestion, isSubject, stripAnswer } from "@/lib/cert/data";
import { getWrongIds } from "@/lib/cert/store";
import type { CertQuestion } from "@/lib/cert/types";
import { Runner } from "@/components/cert/Runner";

// 오답만 모아 연습 모드로 다시 푼다
export default async function WrongRetryPage({ searchParams }: { searchParams: { subject?: string } }) {
  const name = requireUser("/cert/wrong/retry");
  const subject = searchParams.subject && isSubject(searchParams.subject) ? searchParams.subject : null;

  const questions = (await getWrongIds(name))
    .map((id) => getQuestion(id))
    .filter((q): q is CertQuestion => !!q && (!subject || q.subject === subject))
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <Runner
      mode="practice"
      questions={questions.map(stripAnswer)}
      title={`오답 다시 풀기${subject ? ` · ${subject}` : ""}`}
      backHref="/cert/wrong"
      backLabel="오답노트"
    />
  );
}
