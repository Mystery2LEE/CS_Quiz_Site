import re, textwrap
import pdfplumber

WATERMARK = (188, 297, 407, 517)  # 워크북 PDF 중앙 로고 워터마크


def is_watermark(im):
    x0, t, x1, b = WATERMARK
    return abs(im['x0'] - x0) < 3 and abs(im['top'] - t) < 3 and abs(im['x1'] - x1) < 3


def page_lines(pdf):
    """[(page_idx, top, bottom, x0, text, fontname, color)]"""
    out = []
    for i, pg in enumerate(pdf.pages):
        for l in pg.extract_text_lines(return_chars=True):
            c = l['chars'][0]
            out.append(dict(p=i, top=l['top'], bottom=l['bottom'], x0=l['x0'], text=l['text'],
                            font=c['fontname'], color=c.get('non_stroking_color'),
                            size=c['size']))
    return out


NOISE = [re.compile(p) for p in [
    r'^-\s*\d+\s*-$',                       # 쪽번호
    r'^※\s*다음 여백은 연습란',
    r'^이 문제는 \(주\)도서출판길벗',
    r'^기출문제 정답 및 해설$',
    r'^연\s*습\s*란$',
]]


def is_noise(t):
    t = t.strip()
    return any(p.search(t) for p in NOISE)


def region_lines(pdf, start, end, skip=None):
    (sp, sy), (ep, ey) = start, end
    res = []
    for p in range(sp, ep + 1):
        pg = pdf.pages[p]
        top = sy if p == sp else 0
        bot = ey if p == ep else pg.height
        if skip:
            top, bot = skip(p, top, bot, pg)
        for l in _lines_cache(pdf, p):
            if l['top'] >= top - 0.5 and l['bottom'] <= bot + 0.5 and not is_noise(l['text']):
                res.append(l)
    return res


def _lines_cache(pdf, p):
    """페이지별 줄 캐시 — PDF 객체에 붙여 둠 (id() 재사용으로 다른 PDF 캐시가 섞이는 문제 방지)."""
    cache = pdf.__dict__.setdefault('_line_cache', {})
    if p not in cache:
        pg = pdf.pages[p]
        ls = pg.extract_text_lines(return_chars=True, x_tolerance=1.5)
        rm = max([l['x1'] for l in ls] or [0])
        spaces = [c for c in pg.chars if c['text'] == ' ']
        for l in ls:
            l['p'] = p; l['rm'] = rm; l['size'] = l['chars'][0]['size']
            l['trail'] = any(abs(c['top'] - l['top']) < 2 and c['x0'] >= l['x1'] - 1 for c in spaces)
            l['text'] = spaced_text(l['chars'])
        cache[p] = ls
    return cache[p]


BULLET = re.compile(r'^([•\-·※]|[①-⑩㉠-㉭❶-❿⓫-⓴]|\d+[.)]|[가-하][.)]|<|\[)')


def spaced_text(chars):
    """문자 간격으로 공백 수 복원 (코드 정렬 유지, 산문은 1칸). 명시적 공백 문자도 반영."""
    out, prev, sp = '', None, False
    for c in chars:
        if c['text'] == ' ':
            sp = True
            continue
        if prev is not None:
            gap = c['x0'] - prev['x1']
            unit = prev['size'] * 0.5
            n = round(gap / unit) if gap > unit * 0.28 else 0
            if n >= 3:
                out += ' ' * n
            elif gap > unit * 0.28 or sp:
                out += ' '
        out += c['text']
        prev, sp = c, False
    return out


def codey(t):
    t = t.strip()
    if not t or re.match(r'[가-힣]', t):
        return False
    asc = sum(1 for c in t if ord(c) < 128) / len(t)
    return asc > 0.7 and bool(re.search(r'[;{}=]|^\s*(for|if|while|return|print|#include|def |class )', t))


def region_text(pdf, start, end, skip=None, code=False, reflow=True):
    """start/end = (page, y). 줄 단위로 재구성: 들여쓰기는 x0 기준, 줄바꿈 이어붙이기(reflow)."""
    ls = region_lines(pdf, start, end, skip)
    if not ls:
        return ''
    base = min(l['x0'] for l in ls)
    out, prev = [], None
    for l in ls:
        unit = l['size'] * 0.5
        ind = max(0, int(round((l['x0'] - base) / unit)))
        txt = l['text']
        if prev is not None:
            gap = l['top'] - prev['bottom'] if l['p'] == prev['p'] else 0
            if gap > prev['size'] * 1.3:
                out.append('')
            elif (reflow and not code and prev['x1'] > prev['rm'] - 25 and out and out[-1]
                  and not BULLET.match(txt.strip()) and not codey(prev['text']) and not codey(txt)):
                a, b = out[-1], txt.strip()
                out[-1] = a + (' ' if prev.get('trail') else '') + b
                prev = l
                continue
        out.append(' ' * ind + txt)
        prev = l
    return clean('\n'.join(out))


PUA_MAP = {'\ue24b': '⓫', '\ue24c': '⓬', '\ue24d': '⓭', '\ue24e': '⓮', '\uf0ea': '↓', '\ue34c': ''}


def clean(t):
    t = ''.join(PUA_MAP.get(ch, ch) for ch in t)
    lines = [l.rstrip() for l in t.split('\n')]
    # blank collapse
    out = []
    for l in lines:
        if not l.strip():
            if out and out[-1] == '':
                continue
            out.append('')
        else:
            out.append(l)
    while out and out[0] == '':
        out.pop(0)
    while out and out[-1] == '':
        out.pop()
    return textwrap.dedent('\n'.join(out))


def region_needs_image(pdf, start, end, skip=None):
    """그림·표가 있는지 판단: 워터마크 외 이미지, 또는 표 격자(가로·세로선 다수)."""
    (sp, sy), (ep, ey) = start, end
    imgs, hs, vs = 0, set(), set()
    for p in range(sp, ep + 1):
        pg = pdf.pages[p]
        top = sy if p == sp else 0
        bot = ey if p == ep else pg.height
        if skip:
            top, bot = skip(p, top, bot, pg)
        for im in pg.images:
            if is_watermark(im) or im['width'] * im['height'] < 60 * 60:
                continue
            if im['top'] >= top - 2 and im['bottom'] <= bot + 2:
                imgs += 1
        for obj in pg.lines + pg.rects + pg.edges:
            if obj['top'] < top - 1 or obj['bottom'] > bot + 1:
                continue
            w = obj['x1'] - obj['x0']; h = obj['bottom'] - obj['top']
            if h < 1.5 and w > 20:
                hs.add((p, round(obj['top'])))
            elif w < 1.5 and h > 8:
                vs.add((p, round(obj['x0'])))
    return imgs > 0 or (len(hs) >= 7 and len(vs) >= 3) or len(vs) >= 10, dict(imgs=imgs, h=len(hs), v=len(vs))


PROMPT_END = re.compile(r'(쓰시오|서술하시오|구하시오|고르시오|나열하시오|작성하시오|채우시오|설명하시오)\.?\)?\s*(\(\d+점\))?\s*$')


def body_start(pdf, start, end, skip=None):
    """지시문 마지막 줄(및 '(5점)' 줄) 바로 아래 위치 (그림 크롭 시작점)."""
    cand = None
    for l in region_lines(pdf, start, end, skip)[:7]:
        t = l['text'].strip()
        if re.search(r'시오\.?\)?\s*(\(\d+점\))?\s*$', t) or re.fullmatch(r'\(\d+점\)', t):
            cand = l
        elif cand is not None:
            break
    return (cand['p'], cand['bottom'] + 1) if cand else start


def render_region(pdf_path, start, end, out_png, skip=None, pad=4, dpi=150):
    """영역의 실제 내용(bbox)만 PNG로 잘라 저장. QR·아이콘 등 작은 이미지와 6자리 문제코드는 가림."""
    import pypdfium2 as pdfium
    from PIL import Image, ImageDraw
    doc = pdfium.PdfDocument(pdf_path)
    pl = pdfplumber.open(pdf_path)
    (sp, sy), (ep, ey) = start, end
    parts = []
    scale = dpi / 72
    for p in range(sp, ep + 1):
        pg = pl.pages[p]
        top = sy if p == sp else 0
        bot = ey if p == ep else pg.height
        if skip:
            top, bot = skip(p, top, bot, pg)
        if bot - top < 4:
            continue
        inside = lambda o: o['top'] >= top - 0.5 and o['bottom'] <= bot + 0.5
        masks, objs = [], []
        for im in pg.images:
            if not inside(im):
                continue
            if is_watermark(im):
                continue
            if im['width'] * im['height'] < 60 * 60:
                masks.append(im)
            else:
                objs.append(im)
        code_lines = [l for l in _lines_cache(pl, p) if (re.fullmatch(r'\s*\d{6}\s*', l['text']) or is_noise(l['text'])) and inside(l)]
        masks += code_lines
        objs += [c for c in pg.chars if inside(c) and c['text'].strip()
                 and not any(m['x0'] - 1 <= c['x0'] and c['x1'] <= m['x1'] + 1 and m['top'] - 1 <= c['top'] <= m['bottom'] + 1 for m in masks)]
        objs += [o for o in pg.lines + pg.rects + pg.curves if inside(o)]
        if not objs:
            continue
        x0 = max(0, min(o['x0'] for o in objs) - pad); x1 = min(pg.width, max(o['x1'] for o in objs) + pad)
        y0 = max(top, min(o['top'] for o in objs) - pad); y1 = min(bot, max(o['bottom'] for o in objs) + pad)
        img = doc[p].render(scale=scale).to_pil().convert('RGB')
        d = ImageDraw.Draw(img)
        for m in masks:
            d.rectangle([m['x0'] * scale - 2, m['top'] * scale - 2, m['x1'] * scale + 2, m['bottom'] * scale + 2], fill='white')
        parts.append(img.crop((int(x0 * scale), int(y0 * scale), int(x1 * scale), int(y1 * scale))))
    if not parts:
        return False
    W = max(i.width for i in parts); H = sum(i.height for i in parts)
    canvas = Image.new('RGB', (W, H), 'white')
    y = 0
    for i in parts:
        canvas.paste(i, (0, y)); y += i.height
    canvas = canvas.convert('P', palette=Image.ADAPTIVE, colors=64)
    canvas.save(out_png, optimize=True)
    return True


CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩'


def accept_variants(ans):
    """'애자일(Agile)' -> ['애자일(Agile)', '애자일', 'Agile']"""
    ans = ans.strip().strip('•').strip()
    vs = [ans]
    m = re.match(r'^(.+?)\s*\((.+)\)$', ans)
    if m:
        a, b = m.group(1).strip(), m.group(2).strip()
        vs += [a]
        for piece in re.split(r'[;,]\s*', b):
            if piece:
                vs.append(piece.strip())
        vs.append(b)
    seen, out = set(), []
    for v in vs:
        if v and v not in seen:
            seen.add(v); out.append(v)
    return out


def split_prompt_body(stem):
    """첫 문단(지시문)과 본문(지문 박스/코드/보기) 분리. 지시문은 '~시오.' 가 나오는 첫 줄까지
    (뒤따르는 '(단, …)' 단서가 닫힐 때까지 포함)."""
    lines = stem.split('\n')
    k = 0
    while k + 1 < len(lines):   # '쓰시' / '오.' 처럼 쪼개진 줄 합치기
        if lines[k].rstrip().endswith('시') and lines[k + 1].lstrip().startswith('오'):
            lines[k] = lines[k].rstrip() + lines[k + 1].strip(); del lines[k + 1]
        else:
            k += 1
    for i, l in enumerate(lines[:8]):
        m = re.search(r'시오\.?\)?', l)
        if not m or (not re.search(r'시오\.', l) and not re.search(r'시오\s*$', l)):
            continue
        j = i
        depth = lambda s: s.count('(') - s.count(')')
        tail = l[m.start():]
        bal = depth(tail)
        while bal > 0 and j + 1 < len(lines):
            j += 1; bal += depth(lines[j])
        while j + 1 < len(lines) and re.match(r'\s*\(단[,\s]', lines[j + 1]):
            j += 1; bal = depth(lines[j])
            while bal > 0 and j + 1 < len(lines):
                j += 1; bal += depth(lines[j])
        prompt = join_wrapped([x.strip() for x in lines[:j + 1] if x.strip()])
        body = clean('\n'.join(lines[j + 1:]))
        return prompt, body
    first_blank = lines.index('') if '' in lines else len(lines)
    return join_wrapped([x.strip() for x in lines[:first_blank]]), clean('\n'.join(lines[first_blank:]))


def join_wrapped(parts):
    out = ''
    for p in parts:
        if not out:
            out = p
        elif re.search(r'[가-힣]$', out) and re.match(r'[가-힣]', p):
            out += p
        else:
            out += ' ' + p
    return out
