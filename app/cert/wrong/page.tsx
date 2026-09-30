import Link from "next/link";
import { requireUser } from "@/lib/cert/session";
import { getQuestion, isSubject, sourceLabel, SUBJECTS } from "@/lib/cert/data";
import { getPrefs, getStats, getWrongIds } from "@/lib/cert/store";
import type { CertQuestion } from "@/lib/cert/types";
import { GraduateToggle, WrongItem, type WrongEntry } from "@/components/cert/WrongNote";

export default async function WrongPage({ searchParams }: { searchParams: { subject?: string } }) {
  const name = requireUser("/cert/wrong");
  const [wrongIds, stats, prefs] = await Promise.all([getWrongIds(name), getStats(name), getPrefs(name)]);

  const all = wrongIds
    .map((id) => getQuestion(id))
    .filter((q): q is CertQuestion => !!q)
    .sort((a, b) => (stats[b.id]?.lastAt ?? 0) - (stats[a.id]?.lastAt ?? 0));
  const subject = searchParams.subject && isSubject(searchParams.subject) ? searchParams.subject : null;
  const list = subject ? all.filter((q) => q.subject === subject) : all;

  const entries: WrongEntry[] = list.map((q) => {
    const s = stats[q.id];
    return {
      id: q.id,
      source: sourceLabel(q),
      subject: q.subject,
      mode: q.answer.mode,
      prompt: q.prompt,
      wrong: s?.wrong ?? 0,
      streak: s?.streak ?? 0,
      memo: s?.memo ?? "",
      lastAt: s?.lastAt ? new Date(s.lastAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "",
    };
  });

  const chip = (on: boolean) =>
    `text-xs font-mono rounded-md border px-3 py-1.5 transition-colors ${
      on ? "border-brand bg-brand text-white" : "border-line text-ink2 hover:border-brand/50"
    }`;
  const retryHref = subject ? `/cert/wrong/retry?subject=${encodeURIComponent(subject)}` : "/cert/wrong/retry";

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-serif text-2xl text-ink">오답노트</h2>
          <p className="text-xs font-mono text-ink2 mt-1">
            {list.length}문항{subject ? ` · ${subject}` : ""}
          </p>
        </div>
        {list.length > 0 && (
          <Link
            href={retryHref}
            className="rounded-md bg-ink px-5 py-2 text-sm text-paper hover:bg-brand-dark transition-colors"
          >
            다시 풀기 ({list.length}문항)
          </Link>
        )}
      </div>

      <div className="mb-4">
        <GraduateToggle initial={prefs.graduateNow} />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Link href="/cert/wrong" className={chip(!subject)}>
          전체 ({all.length})
        </Link>
        {SUBJECTS.map((s) => {
          const n = all.filter((q) => q.subject === s).length;
          if (n === 0) return null;
          return (
            <Link key={s} href={`/cert/wrong?subject=${encodeURIComponent(s)}`} className={chip(subject === s)}>
              {s} ({n})
            </Link>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-ink2">
          {all.length === 0 ? "아직 오답노트가 비어있어요." : "이 과목에는 틀린 문제가 없어요."}
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <WrongItem key={e.id} entry={e} need={prefs.graduateNow ? 1 : 2} />
          ))}
        </div>
      )}
    </section>
  );
}
