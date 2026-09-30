import Link from "next/link";
import { requireUser } from "@/lib/cert/session";
import { SETS } from "@/lib/cert/data";
import { getSessions } from "@/lib/cert/store";

const STANDARD_COUNT = 20;

export default async function ExamListPage() {
  const name = requireUser("/cert/exam");
  const sessions = (await getSessions(name)).filter((s) => s.type === "exam");

  const exams = SETS.filter((s) => s.kind === "exam").sort(
    (a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.session ?? 0) - (a.session ?? 0)
  );
  const years = [...new Set(exams.map((s) => s.year))];
  const workbooks = SETS.filter((s) => s.kind === "workbook");

  const record = (setId: string) => {
    const mine = sessions.filter((s) => s.setId === setId);
    return { count: mine.length, best: mine.length ? Math.max(...mine.map((s) => s.score100)) : null };
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-serif text-2xl text-ink mb-4">회차별 기출</h2>
        <div className="space-y-6">
          {years.map((year) => (
            <div key={year}>
              <p className="font-mono text-xs tracking-widest text-ink2 uppercase mb-2">{year}년</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {exams
                  .filter((s) => s.year === year)
                  .map((s) => {
                    const r = record(s.id);
                    return (
                      <Link
                        key={s.id}
                        href={`/cert/exam/${s.id}`}
                        className="torn-top block rounded-lg border border-line bg-white shadow-card p-4 hover:border-brand/50 transition-colors"
                        style={{ borderLeftWidth: 4, borderLeftColor: "#4338CA" }}
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-serif text-lg text-ink">
                            {s.title.replace(" 정보처리기사 실기", "")}
                          </span>
                          {s.count !== STANDARD_COUNT && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-amber/10 text-amber border-amber/30">
                              {s.count}문항
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-ink2 font-mono mt-1 block">
                          {r.count > 0 ? `최고 ${r.best}점 · ${r.count}회 응시` : "미응시"}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl text-ink mb-1">유형별 워크북</h2>
        <p className="text-sm text-ink2 mb-4">문항마다 바로 채점하는 연습 모드로 풉니다.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {workbooks.map((s) => (
            <Link
              key={s.id}
              href={`/cert/set/${s.id}`}
              className="torn-top block rounded-lg border border-line bg-white shadow-card p-4 hover:border-brand/50 transition-colors"
              style={{ borderLeftWidth: 4, borderLeftColor: "#C08A22" }}
            >
              <span className="font-serif text-lg text-ink block">{s.title}</span>
              <span className="text-xs text-ink2 font-mono mt-1 block">{s.count}문항</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
