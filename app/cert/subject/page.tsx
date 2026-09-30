import Link from "next/link";
import { requireUser } from "@/lib/cert/session";
import { getStats } from "@/lib/cert/store";
import { progressOf } from "@/lib/cert/progress";

export default async function SubjectListPage() {
  const name = requireUser("/cert/subject");
  const { bySubject } = progressOf(await getStats(name));

  return (
    <section>
      <h2 className="font-serif text-2xl text-ink mb-4">과목별</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {bySubject.map(({ subject, progress }) => (
          <Link
            key={subject}
            href={`/cert/subject/${encodeURIComponent(subject)}`}
            className="torn-top block rounded-lg border border-line bg-white shadow-card p-4 hover:border-brand/50 transition-colors"
            style={{ borderLeftWidth: 4, borderLeftColor: "#C08A22" }}
          >
            <span className="font-serif text-lg text-ink block">{subject}</span>
            <span className="text-xs text-ink2 font-mono mt-1 block">
              {progress.total}문항 · 푼 문제 {progress.solved} · 정답률{" "}
              {progress.accuracy === null ? "—" : `${progress.accuracy}%`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
