"""워크북형 PDF 파서: '1. 문제 … 답 : … [해설] …' 구조.
usage: python parse_workbook.py <pdf> <source_id> <source_title> <category> [lang]
"""
import re, sys, json, os
import pdfplumber
from common import *


def parse(pdf_path, source_id, source_title, category, lang=None, img_dir='out/images'):
    pdf = pdfplumber.open(pdf_path)
    L = page_lines(pdf)
    marks = []  # (kind, idx)
    expect = 1
    for i, l in enumerate(L):
        t = l['text'].strip()
        if l['x0'] > 70:
            continue
        m = re.match(r'^(\d{1,3})\.\s', t)
        if m and int(m.group(1)) == expect:
            marks.append(('q', i, expect)); expect += 1; continue
        if re.match(r'^답(\s*:|$)', t):
            marks.append(('a', i, None)); continue
        if t.startswith('[해설]'):
            marks.append(('e', i, None)); continue
        if re.match(r'^\[[^\]]+\]$', t) and '해설' not in t and re.search(r'[가-힣]', t):
            marks.append(('topic', i, t.strip('[]'))); continue
    end_pos = (len(pdf.pages) - 1, pdf.pages[-1].height)

    def pos(i):
        return (L[i]['p'], L[i]['top'] - 1)

    def after(i):
        return (L[i]['p'], L[i]['bottom'] + 1)

    qs = []
    topic = None
    for k, (kind, i, v) in enumerate(marks):
        if kind == 'topic':
            topic = v; continue
        if kind != 'q':
            continue
        # find a / e / next q
        a_i = e_i = None; nxt = end_pos; a_all = []
        for kind2, j, v2 in marks[k + 1:]:
            if kind2 in ('q', 'topic'):
                nxt = pos(j); break
            if kind2 == 'a' and e_i is None:
                a_all.append(j)
                if a_i is None:
                    a_i = j
            elif kind2 == 'e' and e_i is None:
                e_i = j
        multi = [j for j in a_all if re.match(r'^답\s*:\s*\S', L[j]['text'].strip())]
        if len(a_all) > 1 and len(multi) == len(a_all):
            # 소문항(①, ②…)마다 '답 : x' 가 따로 붙는 형식 → 답 줄만 빼고 전부 문제, 답은 라벨 붙여 모음
            stem_start = pos(i)
            end_i = pos(e_i) if e_i is not None else nxt
            parts, prev = [], stem_start
            for j in a_all:
                parts.append(region_text(pdf, prev, pos(j)))
                prev = after(j)
            stem = re.sub(r'^\d{1,3}\.\s*', '', '\n'.join(parts))
            labels = CIRCLED
            ans_txt = '\n'.join(f'{labels[n]} ' + re.sub(r'^답\s*:\s*', '', L[j]['text'].strip()) for n, j in enumerate(a_all))
            expl = region_text(pdf, after(e_i), nxt) if e_i is not None else ''
            need_img, info = region_needs_image(pdf, stem_start, pos(a_all[-1]))
            prompt, body = split_prompt_body(stem)
            qid = f'{source_id}-{v:03d}'
            image = None
            if need_img:
                os.makedirs(img_dir, exist_ok=True)
                fn = f'{qid}.png'
                render_region(pdf_path, body_start(pdf, stem_start, pos(a_all[0])), pos(a_all[0]), os.path.join(img_dir, fn))
                image = fn
            qs.append(dict(id=qid, source=source_id, sourceTitle=source_title, number=v,
                           category=category, lang=lang, topic=topic,
                           prompt=prompt, body=body, image=image, imageInfo=info,
                           answerRaw=ans_txt, explanation=expl))
            continue
        stem_start = pos(i)
        stem_end = pos(a_i) if a_i is not None else (pos(e_i) if e_i is not None else nxt)
        stem = region_text(pdf, stem_start, stem_end)
        stem = re.sub(r'^\d{1,3}\.\s*', '', stem)
        ans_end = pos(e_i) if e_i is not None else nxt
        ans_txt = ''
        if a_i is not None:
            ans_txt = region_text(pdf, pos(a_i), ans_end)
            ans_txt = re.sub(r'^답\s*:?\s*', '', ans_txt).strip()
        expl = region_text(pdf, after(e_i), nxt) if e_i is not None else ''
        need_img, info = region_needs_image(pdf, stem_start, stem_end)
        prompt, body = split_prompt_body(stem)
        qid = f'{source_id}-{v:03d}'
        image = None
        if need_img:
            os.makedirs(img_dir, exist_ok=True)
            fn = f'{qid}.png'
            render_region(pdf_path, body_start(pdf, stem_start, stem_end), stem_end, os.path.join(img_dir, fn))
            image = fn
        qs.append(dict(id=qid, source=source_id, sourceTitle=source_title, number=v,
                       category=category, lang=lang, topic=topic,
                       prompt=prompt, body=body, image=image, imageInfo=info,
                       answerRaw=ans_txt, explanation=expl))
    return qs


if __name__ == '__main__':
    pdf, sid, title, cat = sys.argv[1:5]
    lang = sys.argv[5] if len(sys.argv) > 5 else None
    qs = parse(pdf, sid, title, cat, lang)
    os.makedirs('out', exist_ok=True)
    json.dump(qs, open(f'out/raw_{sid}.json', 'w'), ensure_ascii=False, indent=1)
    print(sid, len(qs), 'questions;', sum(1 for q in qs if q['image']), 'with image')
