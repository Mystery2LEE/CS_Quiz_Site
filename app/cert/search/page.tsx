import Link from "next/link";
import { requireUser } from "@/lib/cert/session";
import { search, sourceLabel } from "@/lib/cert/data";
import { MODE_LABELS, MODE_STYLES } from "@/lib/cert/public";

const LIMIT = 100;

// prompt·body·answer.display·explanation 전문 검색. 결과에는 정답을 싣지 않고 문제 페이지로 연결한다.
export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = (searchParams.q ?? "").trim().slice(0, 100);
  requireUser(query ? `/cert/search?q=${encodeURIComponent(query)}` : "/cert/search");
  const results = query ? search(query, LIMIT) : [];
  const chip = "text-[10px] font-mono px-1.5 py-0.5 rounded border";

  return (
    <section>
      <h2 className="font-serif text-2xl text-ink mb-4">검색</h2>
      <form action="/cert/search" className="flex gap-2 mb-5">
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoFocus={!query}
          placeholder="문제·정답·해설 검색 (예: 정규화, malloc, GROUP BY)"
          className="flex-1 min-w-0 rounded-md border border-line px-3 py-2 bg-white text-ink placeholder:text-ink2/50"
        />
        <button className="shrink-0 rounded-md bg-ink px-5 py-2 text-paper hover:bg-brand-dark transition-colors">
          검색
        </button>
      </form>

      {query && (
        <p className="text-xs font-mono text-ink2 mb-3">
          “{query}” 검색 결과 {results.length}건{results.length >= LIMIT ? ` (처음 ${LIMIT}건만 표시)` : ""}
        </p>
      )}

      {query && results.length === 0 && (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-ink2">
          검색 결과가 없습니다.
        </div>
      )}

      <div className="space-y-3">
        {results.map((q) => (
          <Link
            key={q.id}
            href={`/cert/q/${q.id}`}
            className="torn-top block rounded-lg border border-line bg-white shadow-card p-4 hover:border-brand/50 transition-colors"
            style={{ borderLeftWidth: 4, borderLeftColor: MODE_STYLES[q.answer.mode].tab }}
          >
            <span className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`${chip} border-line bg-paper text-ink2`}>{sourceLabel(q)}</span>
              <span className={`${chip} border-line bg-paper text-ink2`}>{q.subject}</span>
              {q.lang && <span className={`${chip} border-line bg-paper text-ink2`}>{q.lang}</span>}
              <span className={`${chip} ${MODE_STYLES[q.answer.mode].badge}`}>{MODE_LABELS[q.answer.mode]}</span>
            </span>
            <span className="block text-sm text-ink leading-snug">{q.prompt}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
