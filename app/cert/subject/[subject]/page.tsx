import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/cert/session";
import { bySubject, isSubject, kindOf, shuffled, stripAnswer } from "@/lib/cert/data";
import { getStats, getWrongIds } from "@/lib/cert/store";
import { LANGS } from "@/lib/cert/public";
import { Runner } from "@/components/cert/Runner";

type Filters = { src?: string; lang?: string; unsolved?: string; wrong?: string; shuffle?: string };

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: { subject: string };
  searchParams: Filters;
}) {
  const subject = decodeURIComponent(params.subject);
  const base = `/cert/subject/${encodeURIComponent(subject)}`;
  const name = requireUser(base);
  if (!isSubject(subject)) notFound();

  const [stats, wrongIds] = await Promise.all([getStats(name), getWrongIds(name)]);
  const wrongSet = new Set(wrongIds);

  const src = searchParams.src === "exam" || searchParams.src === "workbook" ? searchParams.src : null;
  const lang = (LANGS as readonly string[]).includes(searchParams.lang ?? "") ? searchParams.lang! : null;
  const unsolved = searchParams.unsolved === "1";
  const wrong = searchParams.wrong === "1";
  const shuffle = searchParams.shuffle === "1";

  const all = bySubject(subject);
  let list = all.filter(
    (q) =>
      (!src || kindOf(q) === src) &&
      (!lang || q.lang === lang) &&
      (!unsolved || (stats[q.id]?.tries ?? 0) === 0) &&
      (!wrong || wrongSet.has(q.id))
  );
  if (shuffle) list = shuffled(list);

  // 현재 필터에서 하나만 바꾼 링크
  const current: Record<string, string | null> = {
    src,
    lang,
    unsolved: unsolved ? "1" : null,
    wrong: wrong ? "1" : null,
    shuffle: shuffle ? "1" : null,
  };
  const href = (patch: Record<string, string | null>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...patch })) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };
  const chip = (on: boolean) =>
    `text-xs font-mono rounded-md border px-3 py-1.5 transition-colors ${
      on ? "border-brand bg-brand text-white" : "border-line text-ink2 hover:border-brand/50"
    }`;
  const hasLangs = all.some((q) => q.lang);

  return (
    <div>
      <div className="max-w-3xl mx-auto mb-5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-ink2 w-10">출처</span>
          <Link href={href({ src: null })} className={chip(!src)}>
            전체
          </Link>
          <Link href={href({ src: "exam" })} className={chip(src === "exam")}>
            기출
          </Link>
          <Link href={href({ src: "workbook" })} className={chip(src === "workbook")}>
            워크북
          </Link>
        </div>
        {hasLangs && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-ink2 w-10">언어</span>
            <Link href={href({ lang: null })} className={chip(!lang)}>
              전체
            </Link>
            {LANGS.map((l) => (
              <Link key={l} href={href({ lang: l })} className={chip(lang === l)}>
                {l}
              </Link>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-ink2 w-10">조건</span>
          <Link href={href({ unsolved: unsolved ? null : "1" })} className={chip(unsolved)}>
            안 푼 문제만
          </Link>
          <Link href={href({ wrong: wrong ? null : "1" })} className={chip(wrong)}>
            틀린 문제만
          </Link>
          <Link href={href({ shuffle: shuffle ? null : "1" })} className={chip(shuffle)}>
            섞기
          </Link>
          <span className="text-xs font-mono text-ink2 ml-auto">
            {list.length} / {all.length}문항
          </span>
        </div>
      </div>

      <Runner
        key={list.map((q) => q.id).join(",")}
        mode="practice"
        questions={list.map(stripAnswer)}
        title={subject}
        backHref="/cert/subject"
        backLabel="과목 목록"
      />
    </div>
  );
}
