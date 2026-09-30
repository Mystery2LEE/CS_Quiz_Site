"""기출 회차형 PDF 파서 (시나공 기출 형식):
  문제 페이지: '문제 N …(5점)' … ' :' (답란)
  정답 페이지: '[문제 N]' 정답 … '해설' …
usage: python parse_exam.py <pdf> <round_id e.g. 2020-1> <title>
"""
import re, sys, json, os
import pdfplumber
from common import *

# 형식 A: 시나공 교재형(머리글·바닥글 있음, 답란 아이콘) / 형식 B: 시나공 카페 배포형(쪽번호 바닥글)
FMT = {
    'A': dict(header=62, footer=650),
    'B': dict(header=0, footer=784),
}
_cur = dict(FMT['A'])


def skip(p, top, bot, pg):
    return max(top, _cur['header']), min(bot, _cur['footer'])


def detect_format(pdf):
    t = (pdf.pages[min(2, len(pdf.pages) - 1)].extract_text() or '')
    return 'A' if '것만' in t and '공 부한다' in t or pdf.pages[0].height < 700 else 'B'


def parse(pdf_path, round_id, title, img_dir='out/images'):
    pdf = pdfplumber.open(pdf_path)
    fmt = detect_format(pdf)
    _cur.update(FMT[fmt])
    allL = page_lines(pdf)
    L = [l for l in allL if _cur['header'] <= l['top'] < _cur['footer'] and not is_noise(l['text'])]
    a0 = next(l for l in allL if '정답 및 해설' in l['text'] and l['p'] > 0)
    ans_idx = next(i for i, l in enumerate(L) if (l['p'], l['top']) > (a0['p'], a0['top']))

    qstarts, blanks, astarts, expl_marks = {}, [], {}, []
    expect = 1
    for i, l in enumerate(L):
        t = l['text'].strip()
        if i < ans_idx:
            m = re.match(r'^문제\s*(\d{1,2})(?!\d)', t)
            if m and int(m.group(1)) == expect and l['x0'] < 80:
                qstarts[expect] = i; expect += 1
            elif t.startswith('\ue34c') or re.fullmatch(r'(답\s*)?:|답', t) or re.match(r'^답\s*:', t):
                blanks.append(i)
        else:
            m = re.match(r'^\[문제\s*(\d{1,2})\]', t)
            if m:
                astarts.setdefault(int(m.group(1)), i)
            elif t in ('해설', '[해설]'):
                expl_marks.append(i)

    def pos(i):
        return (L[i]['p'], L[i]['top'] - 1)

    def after(i):
        return (L[i]['p'], L[i]['bottom'] + 1)

    nums = sorted(qstarts)
    anums = sorted(astarts)
    last = (len(pdf.pages) - 1, _cur['footer'])
    qs = []
    for k0, n in enumerate(nums):
        qi = qstarts[n]
        q_next = qstarts[nums[k0 + 1]] if k0 + 1 < len(nums) else ans_idx
        bi = next((b for b in blanks if qi < b < q_next), None)
        stem_start = pos(qi)
        stem_end = pos(bi if bi is not None else q_next)
        stem = region_text(pdf, stem_start, stem_end, skip)
        stem = re.sub(r'^\s*문제\s*\d+\s*', '', stem)
        pts = re.search(r'\((\d+)점\)', stem)
        points = int(pts.group(1)) if pts else 5
        stem = re.sub(r'\s*\(\d+점\)', '', stem, count=1)
        stem = '\n'.join(x for x in stem.split('\n') if not re.fullmatch(r'\s*\d{6}\s*', x))
        stem = re.sub(r'\n\s*답\s*:\s*$', '', stem).strip()
        prompt, body = split_prompt_body(stem)
        need_img, info = region_needs_image(pdf, stem_start, stem_end, skip)
        qid = f'{round_id}-{n:02d}'
        image = None
        if need_img:
            os.makedirs(img_dir, exist_ok=True)
            fn = f'{qid}.png'
            render_region(pdf_path, body_start(pdf, stem_start, stem_end, skip), stem_end, os.path.join(img_dir, fn), skip)
            image = fn
        # 정답/해설
        if n not in astarts:
            qs.append(dict(id=qid, source='exam', sourceTitle=title, round=round_id, number=n, points=points,
                           prompt=prompt, body=body, image=image, imageInfo=info, answerRaw='',
                           essay=False, keywords=[], explanation=''))
            continue
        ai = astarts[n]
        k = anums.index(n)
        nxt_i = astarts[anums[k + 1]] if k + 1 < len(anums) else None
        nxt = pos(nxt_i) if nxt_i is not None else last
        ei = next((e for e in expl_marks if e > ai and (nxt_i is None or e < nxt_i)), None)
        ans_end = pos(ei) if ei is not None else nxt
        ans = region_text(pdf, pos(ai), ans_end, skip)
        ans = re.sub(r'^\s*\[문제\s*\d+\]\s*', '', ans)
        ans = re.sub(r'\[답안 작성 방법 안내\][^\n]*\n[^\n]*', '', ans).strip()
        note = ''
        mm = re.search(r'※\s*답안 작성 시 주의 사항.*', ans, re.S)
        if mm:
            note = mm.group(0); ans = ans[:mm.start()].strip()
        essay_mark = '밑줄이 표시된 내용은 반드시 포함' in ans
        underlined = []
        if essay_mark:
            underlined = underlined_phrases(pdf, after(ai), ans_end, skip)
            ans = re.sub(r'^다음 중 밑줄이 표시된 내용은 반드시 포함되어야 합니다\.\s*', '', ans).strip()
        expl = region_text(pdf, after(ei), nxt, skip) if ei is not None else ''
        expl = re.sub(r'\[답안 작성 방법 안내\][^\n]*\n[^\n]*\n?', '', expl).strip()
        expl = re.sub(r'(?m)^\s*\d{4}년 \d+회 정보처리기사 실기 정답 및 해설\s*$', '', expl).strip()
        if note:
            expl = (note.replace('\n', ' ') + ('\n\n' + expl if expl else '')).strip()
        qs.append(dict(id=qid, source='exam', sourceTitle=title, round=round_id, number=n,
                       points=points, prompt=prompt, body=body, image=image, imageInfo=info,
                       answerRaw=ans, essay=essay_mark, keywords=underlined, explanation=expl))
    return qs


def underlined_phrases(pdf, start, end, skip):
    """밑줄(가는 가로선) 바로 위 글자들을 모아 필수 키워드로 반환."""
    (sp, sy), (ep, ey) = start, end
    res = []
    for p in range(sp, ep + 1):
        pg = pdf.pages[p]
        top = sy if p == sp else 0
        bot = ey if p == ep else pg.height
        top, bot = skip(p, top, bot, pg)
        segs = [o for o in pg.lines + pg.rects + pg.edges
                if top <= o['top'] <= bot and (o['bottom'] - o['top']) < 1.5 and (o['x1'] - o['x0']) > 5]
        for s in segs:
            cs = [c for c in pg.chars if c['x0'] >= s['x0'] - 1 and c['x1'] <= s['x1'] + 1
                  and -3 < s['top'] - c['bottom'] < 4]
            if cs:
                cs.sort(key=lambda c: c['x0'])
                txt = spaced_text(cs).strip()
                if txt and txt not in res:
                    res.append(txt)
    return res


if __name__ == '__main__':
    pdf, rid, title = sys.argv[1:4]
    qs = parse(pdf, rid, title)
    os.makedirs('out', exist_ok=True)
    json.dump(qs, open(f'out/raw_{rid}.json', 'w'), ensure_ascii=False, indent=1)
    print(rid, len(qs), 'questions;', sum(1 for q in qs if q['image']), 'with image')
