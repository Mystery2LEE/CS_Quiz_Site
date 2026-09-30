import Link from "next/link";
import { requireUser } from "@/lib/cert/session";
import { allQuestions, SETS, SUBJECTS } from "@/lib/cert/data";
import { getSessions, getStats, getWrongIds } from "@/lib/cert/store";
import { fmtDate, progressOf } from "@/lib/cert/progress";
import { endlessPool } from "@/lib/cert/endless";
import { ENDLESS_EXCLUDED_YEARS } from "@/lib/cert/public";

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

export default async function CertHome() {
  const name = requireUser("/cert");
  const [stats, wrongIds, sessions] = await Promise.all([
    getStats(name),
    getWrongIds(name),
    getSessions(name),
  ]);
  const { overall, bySubject } = progressOf(stats);
  const exams = SETS.filter((s) => s.kind === "exam");
  const examCount = allQuestions().filter((q) => exams.some((s) => s.id === q.setId)).length;
  const lastMock = sessions.find((s) => s.type === "mock");
  const endlessCount = endlessPool({ source: "all", subject: null }).length;

  const cards = [
    {
      href: "/cert/exam",
      title: "회차별 기출",
      desc: `${exams.length}회분 · ${examCount}문항 · 실전/연습 모드`,
      tab: "#4338CA",
    },
    { href: "/cert/subject", title: "과목별", desc: `${SUBJECTS.length}과목 · 필터·섞기`, tab: "#C08A22" },
    { href: "/cert/mock", title: "랜덤 모의고사", desc: "20문항 · 150분 타이머 · 합격 판정", tab: "#0F7A72" },
    {
      href: "/cert/endless",
      title: "무한 풀기",
      desc: `${endlessCount}문항 · 무작위로 끝없이 · ${ENDLESS_EXCLUDED_YEARS.join("·")}년 기출 제외`,
      tab: "#5B4FE0",
    },
    { href: "/cert/wrong", title: "오답노트", desc: `${wrongIds.length}문항 · 다시 풀기·메모`, tab: "#14161F" },
  ];

  return (
    <div className="space-y-8">
      <form action="/cert/search" className="flex gap-2">
        <input
          type="search"
          name="q"
          placeholder="문제·정답·해설 검색 (예: 정규화, malloc, GROUP BY)"
          className="flex-1 min-w-0 rounded-md border border-line px-3 py-2 bg-white text-ink placeholder:text-ink2/50"
        />
        <button className="shrink-0 rounded-md bg-ink px-5 py-2 text-paper hover:bg-brand-dark transition-colors">
          검색
        </button>
      </form>

      <section className="grid sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="torn-top block rounded-lg border border-line bg-white shadow-card p-5 hover:border-brand/50 transition-colors"
            style={{ borderLeftWidth: 4, borderLeftColor: c.tab }}
          >
            <span className="font-serif text-xl text-ink block">{c.title}</span>
            <span className="text-xs text-ink2 font-mono mt-1 block">{c.desc}</span>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="font-serif text-2xl text-ink mb-4">내 진행률</h2>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-line bg-white p-4">
            <p className="text-xs font-mono text-ink2 mb-1">푼 문제</p>
            <p className="font-serif text-2xl text-ink tabular-nums">
              {overall.solved}
              <span className="text-sm text-ink2 font-sans font-normal"> / {overall.total}</span>
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white p-4">
            <p className="text-xs font-mono text-ink2 mb-1">전체 정답률</p>
            <p className="font-serif text-2xl text-ink tabular-nums">{pct(overall.accuracy)}</p>
          </div>
          <div className="rounded-lg border border-line bg-white p-4">
            <p className="text-xs font-mono text-ink2 mb-1">최근 모의고사</p>
            {lastMock ? (
              <p className="font-serif text-2xl text-ink tabular-nums">
                {lastMock.score100}점
                <span
                  className={`text-sm font-sans font-normal ml-2 ${
                    lastMock.pass ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {lastMock.pass ? "합격" : "불합격"} · {fmtDate(lastMock.endedAt)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-ink2 pt-1.5">아직 응시 기록이 없어요.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono text-ink2 border-b border-line">
                <th className="px-4 py-2 font-normal">과목</th>
                <th className="px-4 py-2 font-normal text-right">푼 문제</th>
                <th className="px-4 py-2 font-normal text-right">정답률</th>
              </tr>
            </thead>
            <tbody>
              {bySubject.map(({ subject, progress }) => (
                <tr key={subject} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/cert/subject/${encodeURIComponent(subject)}`}
                      className="text-ink hover:text-brand"
                    >
                      {subject}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink2">
                    {progress.solved} / {progress.total}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink">{pct(progress.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sessions.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl text-ink mb-4">최근 응시 기록</h2>
          <ul className="rounded-lg border border-line bg-white divide-y divide-line/60">
            {sessions.slice(0, 5).map((s) => (
              <li key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="text-ink truncate">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-line bg-paper text-ink2 mr-2">
                    {s.type === "mock" ? "모의고사" : "기출"}
                  </span>
                  {s.title}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums">
                  <span className={s.pass ? "text-green-700" : "text-red-700"}>
                    {s.score100}점 · {s.pass ? "합격" : "불합격"}
                  </span>
                  <span className="text-ink2"> · {fmtDate(s.endedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
