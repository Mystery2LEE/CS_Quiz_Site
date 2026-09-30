import { notFound } from "next/navigation";
import { requireUser } from "@/lib/cert/session";
import { bySet, getSet, stripAnswer } from "@/lib/cert/data";
import { Runner } from "@/components/cert/Runner";

// 워크북 세트 풀이 (연습 모드). 소단원(topic)은 Runner가 그룹 헤더로 보여준다.
export default function WorkbookPage({ params }: { params: { setId: string } }) {
  requireUser(`/cert/set/${params.setId}`);
  const set = getSet(params.setId);
  if (!set || set.kind !== "workbook") notFound();

  return (
    <Runner
      mode="practice"
      questions={bySet(set.id).map(stripAnswer)}
      title={set.title}
      backHref="/cert/exam"
      backLabel="회차·워크북 목록"
    />
  );
}
