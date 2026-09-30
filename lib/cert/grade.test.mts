import { grade, normalizeShort, passResult } from './grade.ts';
import fs from 'node:fs';
const qs = JSON.parse(fs.readFileSync(new URL('../../data/cert/questions.json', import.meta.url),'utf8'));
let fail = 0; const f = (m) => { fail++; console.log('FAIL', m); };
for (const q of qs) {
  if (q.answer.mode === 'essay') continue;
  // 모든 허용 답안이 정답 처리되는지
  const maxV = Math.max(...q.answer.blanks.map(b => b.accept.length));
  for (let v = 0; v < maxV; v++) {
    const inp = q.answer.blanks.map(b => b.accept[Math.min(v, b.accept.length-1)]);
    const r = grade(q, inp);
    if (!r.correct || r.score !== q.points) f(`${q.id} variant ${v} ${JSON.stringify(inp)}`);
  }
  // 빈 답은 오답
  if (grade(q, q.answer.blanks.map(()=>'')).score !== 0) f(`${q.id} empty scored`);
  // 순서 무관이면 역순도 정답
  if (!q.answer.ordered) {
    const inp = q.answer.blanks.map(b => b.accept[0]).reverse();
    if (!grade(q, inp).correct) f(`${q.id} reversed`);
  }
}
const byId = Object.fromEntries(qs.map(q=>[q.id,q]));
const T = (id, inp, exp) => { const r = grade(byId[id], inp); if (r.correct !== exp) f(`${id} ${JSON.stringify(inp)} expected ${exp} got ${r.correct}`); };
T('wb01-001', ['agile'], true);
T('wb01-001', ['애 자 일'], true);
T('wb01-001', ['워터폴'], false);
T('wb01-014', ['ㄴ','ㄷ','ㄱ','ㄹ','ㅁ'], true);         // ㉠ 대신 ㄱ 입력
T('wb01-014', ['ㄴ','ㄷ','ㄱ','ㅁ','ㄹ'], false);
T('wb01-096', ['extend()','pop','reverse( )'], true);
T('wb01-016', ['∪','-','x','π','⋈'], true);
T('2020-1-04', ['0 1 2 3'], true);
T('2020-1-04', ['0  1 2 3 '], true);
T('2020-1-04', ['0, 1, 2, 3'], false);                  // 쉼표 → 오답 (실제 채점 기준)
T('2020-1-04', ['0123'], false);
T('wb07-009', ['Vehicle name : Spark'], true);
T('wb07-009', ['vehicle name : spark'], false);         // 출력은 대소문자 구분
T('2020-1-16', ['H','F'], true);
T('2020-1-11', ['timing','구문','의미'], true);
T('2020-1-06', ['20'], true);
T('2020-1-06', ['20개월'], true);
T('2020-1-17', ['200','3','1'], true);
T('2023-2-15', ['SEED, DES, AES, ARIA', 'ecc,rsa'], true);
T('2023-2-15', ['DES, ARIA, SEED', 'RSA, ECC'], false);
T('2024-1-11', ['5 6 3 1 7 2'], true);
T('2024-1-11', ['⑤→⑥→③→①→⑦→②'], true);
T('2024-1-11', ['6 5 3 1 7 2'], false);
T('2024-2-20', ['A->D->C->F'], true);
T('2021-2-14', ['Locking'], true);
T('2020-2-06', ["select 학번,이름 from 학생 where 학년 in (3,4)"], true);
T('2023-1-13', ["DELETE FROM 학생 WHERE 이름 = '민수';"], true);
const part = grade(byId['2020-1-08'], ['처리량','틀림','경과 시간']);
if (part.score !== 3.3) f('partial score '+part.score);
const e = grade(byId['2020-1-09'], ['정규화된 데이터 모델을 통합, 중복, 분리하는 과정이며 정규화 원칙을 위배한다']);
if (e.correct !== null || !e.keywordHits.every(k=>k.hit)) f('essay keywords '+JSON.stringify(e.keywordHits));
const p = passResult([grade(byId['wb01-001'],['Agile']), grade(byId['wb01-004'],['x'])]);
if (p.score100 !== 50 || p.pass) f('pass '+JSON.stringify(p));
console.log(fail ? `${fail} failures` : 'ALL PASS', 'questions:', qs.length);
