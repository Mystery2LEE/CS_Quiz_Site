"""raw_*.json → 최종 문제은행 (questions.json, sets.json).
usage: python build.py            (out/raw_*.json 전부 읽음)
출력: dist/data/cert/questions.json, dist/data/cert/sets.json, dist/public/cert/images/*.png
"""
import json, re, os, glob, shutil
from common import accept_variants

SUBJECTS = ['소프트웨어 설계', '데이터베이스', 'SQL', '인터페이스·UI', '테스트',
            '보안', '네트워크', '운영체제', '프로그래밍', '패키징·신기술']

# ── 과목 분류 키워드 (점수 합산, 가장 높은 과목) ─────────────────────────
KW = {
    '보안': ['보안', '암호', '공격', '해킹', '인증', '접근통제', '접근 통제', 'Injection', '스니핑', '스푸핑',
            '바이러스', '웜', 'DoS', '취약', '위협', '악성', '방화벽', 'VPN', '침입', 'AAA', 'SSO', 'ISMS',
            'Hijacking', '하이재킹', '랜섬', '피싱', '키로거', '백도어', 'MD5', 'SHA', 'RSA', 'AES', 'DES'],
    '네트워크': ['네트워크', '프로토콜', 'OSI', 'TCP', 'UDP', '라우팅', '서브넷', 'Subnet', 'IPv', '브로드캐스트',
              '계층(Layer)', 'ICMP', 'ARP', 'NAT', '회선', '인터넷', 'HTTP'],
    '데이터베이스': ['데이터베이스', '트랜잭션', '트랙잭션', '정규화', '릴레이션', '관계대수', '관계해석', '튜플', '스키마',
                '카디널리티', 'E-R', '이상(Anomaly)', '병행제어', '회복', '함수적 종속', '키(Key)', '색인', '인덱스',
                '데이터 모델', 'REDO', 'UNDO', '로킹'],
    'SQL': ['SELECT', 'INSERT', 'UPDATE ', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'GRANT', 'REVOKE', 'COMMIT',
            'ROLLBACK', 'SQL문', 'DCL', 'DDL', 'DML'],
    '테스트': ['테스트', '커버리지', '오라클', '결함', '살충제', '스텁', '드라이버', '품질 분석', '동치', '경계값'],
    '인터페이스·UI': ['인터페이스', 'UI', 'UX', 'XML', 'JSON', 'AJAX', 'EAI', 'ESB', '웹 서비스', 'SOAP', 'WSDL',
                  'IPC', 'JUnit', '연계'],
    '소프트웨어 설계': ['패턴', 'Observer', 'Singleton', 'Visitor', 'Factory', 'Bridge', 'Proxy', 'Iterator', 'Adapter',
                  'Decorator', 'Composite', 'Strategy', 'ISP', 'SRP', 'OCP', 'LSP', 'DIP', 'SOLID', 'Coupling', 'Cohesion', 'UML', '디자인 패턴', '결합도', '응집도', '모듈', '팬인', 'Fan-In', '객체지향', '요구사항',
                  '애자일', '방법론', 'LOC', 'COCOMO', '리팩토링', '럼바우', '다이어그램', '클래스'],
    '운영체제': ['운영체제', '스케줄링', '프로세스', '리눅스', 'UNIX', '유닉스', '메모리', '페이지 교체', 'chmod',
              '교착상태', 'RAID', 'HRN', 'SJF', '안드로이드'],
    '패키징·신기술': ['패키징', '릴리즈', '형상', '저작권', 'DRM', '빅데이터', '클라우드', '블록체인', '하둡',
                 '데이터 마이닝', 'Linked', '링크드', '매뉴얼'],
    '프로그래밍': ['헝가리안', '생성자', 'Python', 'C++', '메소드'],
}

# ── 이번 3개 PDF에 대한 수동 보정 (분류·정답) ──────────────────────────
SUBJECT_OVERRIDE = {
    **{f'wb01-{n:03d}': '소프트웨어 설계' for n in list(range(1, 9)) + list(range(34, 41)) + [43, 44, 45]},
    **{f'wb01-{n:03d}': '데이터베이스' for n in list(range(9, 29)) + [30, 125, 126]},
    'wb01-029': '보안', 'wb01-041': '인터페이스·UI', 'wb01-050': '보안',
    **{f'wb01-{n:03d}': '인터페이스·UI' for n in [31, 32, 33, 46, 47, 48, 49, 51, 52, 53, 54, 55, 56]},
    **{f'wb01-{n:03d}': '테스트' for n in [42] + list(range(57, 75))},
    'wb01-075': 'SQL', 'wb01-076': 'SQL',
    **{f'wb01-{n:03d}': '보안' for n in list(range(77, 92)) + [93, 114, 120, 121]},
    'wb01-092': '프로그래밍', 'wb01-094': '프로그래밍', 'wb01-096': '프로그래밍',
    **{f'wb01-{n:03d}': '운영체제' for n in [95, 97, 98, 99, 100, 101, 122]},
    **{f'wb01-{n:03d}': '네트워크' for n in [102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 115, 116, 118]},
    **{f'wb01-{n:03d}': '패키징·신기술' for n in [117, 119, 123, 124, 127, 128, 129, 130]},
    '2020-2-01': '데이터베이스',
    '2020-2-07': 'SQL',
    '2021-3-03': 'SQL',
    '2020-2-08': '보안',
    '2020-2-13': '인터페이스·UI',
    '2023-2-12': '네트워크',
    '2023-3-17': '패키징·신기술',
    '2024-1-07': '운영체제',
    '2024-2-20': '네트워크',
    '2024-3-16': '데이터베이스',
    '2024-3-05': '보안',
    '2024-2-12': '보안',
    '2020-1-01': '인터페이스·UI', '2020-1-02': '인터페이스·UI', '2020-1-03': '패키징·신기술',
    '2020-1-05': '소프트웨어 설계', '2020-1-06': '소프트웨어 설계', '2020-1-07': '데이터베이스',
    '2020-1-08': '테스트', '2020-1-09': '데이터베이스', '2020-1-10': '보안', '2020-1-11': '네트워크',
    '2020-1-12': '보안', '2020-1-13': '테스트', '2020-1-15': '네트워크', '2020-1-16': '소프트웨어 설계',
    '2020-1-17': 'SQL', '2020-1-18': '패키징·신기술', '2020-1-19': '운영체제',
}
# 정답 수동 보정: id → blanks 리스트 (label, [accept...])
ANSWER_OVERRIDE = {
    'wb01-106': [('①', ['데이터 링크 계층', 'Data Link Layer', '데이터 링크']),
               ('②', ['네트워크 계층', '망 계층', 'Network Layer']),
               ('③', ['표현 계층', 'Presentation Layer'])],
    'wb01-122': [(None, ['0', 'Level 0', 'RAID 0'])],
    'wb01-101': [(None, ['chmod 751 a.txt'])],
    '2021-3-19': [(None, ['GUI', 'Graphical User Interface', 'Graphic User Interface', '그래픽 사용자 인터페이스'])],
    'wb01-016': [('①', ['∪']), ('②', ['―', '-']), ('③', ['×', 'x']), ('④', ['π']), ('⑤', ['▷◁', '⋈'])],
}
# 문제 본문/정답 직접 지정 (PDF에서 정답이 문제 안에 같이 인쇄된 경우 등)
RAW_OVERRIDE = {
    'wb06-001': dict(
        body=None,  # 아래 main()에서 원문 body의 '배열 <field>' 앞까지만 사용
        body_suffix='배열 <field>\n 0 1 0 1\n 0 0 0 1\n 1 1 1 0\n 0 1 1 1\n\n배열 <mines> 의 값을 4줄로 쓰시오.',
        answerRaw='1 1 3 2\n3 4 5 3\n3 5 6 4\n3 5 5 3', image=None, mode='output'),
}
MODE_OVERRIDE = {'wb01-060': 'essay', 'wb01-101': 'short'}


def classify(q):
    if q['id'] in SUBJECT_OVERRIDE:
        return SUBJECT_OVERRIDE[q['id']]
    if q.get('category') in ('SQL', '프로그래밍'):
        return q['category']
    text = ' '.join([q['prompt'], q['body']])
    ans = q['answerRaw']
    if 'Injection' in text + ans:
        return '보안'
    if re.search(r'\bSELECT\b|\bFROM\b|\bWHERE\b|SQL문|SQL 문', text + ' ' + ans) or re.search(r'^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b', ans):
        return 'SQL'
    if detect_lang(q) in ('C', 'Java', 'Python') or re.search(r'(C\s*언어|Java|JAVA|Python|파이썬).{0,15}(프로그램|코드)', q['prompt']):
        return '프로그래밍'
    scores = {s: sum(text.count(k) for k in ks) + 3 * sum(ans.count(k) for k in ks) for s, ks in KW.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else '패키징·신기술'


def detect_lang(q):
    b = q['body']
    if '#include' in b or 'printf' in b:
        return 'C'
    if re.search(r'public\s+(static\s+)?|System\.out|class\s+\w+\s*(extends\s+\w+\s*)?\{', b):
        return 'Java'
    if re.search(r'^\s*(def |print\(|for \w+ in )', b, re.M) or 'Python' in q['prompt']:
        return 'Python'
    if re.search(r'\bSELECT\b|\bFROM\b|\bWHERE\b', b):
        return 'SQL'
    return None


def is_code_q(q):
    return bool(re.search(r'(C언어|Java|JAVA|Python|파이썬|C\+\+).{0,15}(프로그램|코드)', q['prompt'])) \
        or '실행 결과' in q['prompt']


def split_top_commas(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur.strip()); cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def variants(v):
    res = []
    for part in re.split(r'\s+또는\s+', v):
        res += accept_variants(part)
    seen, out = set(), []
    for x in res:
        if x not in seen:
            seen.add(x); out.append(x)
    return out


SQL_START = re.compile(r'^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE)\b', re.I)
SEQ_ITEM = r'[\w①-⑩㉠-㉭]+'


def preprocess(r):
    """정답 원문에서 [풀이]·[답안 작성 시 주의 사항]·※ 안내문을 분리하고 플래그를 세팅."""
    raw = r['answerRaw'].strip()
    extra = []
    m = re.search(r'\[풀이\]', raw)
    if m:
        extra.append(raw[m.end():].strip()); raw = raw[:m.start()].strip()
    m = re.search(r'\[답안\s*작성 시 주의 사항\]', raw)
    if m:
        extra.insert(0, '※ ' + re.sub(r'\s*\n\s*', ' ', raw[m.end():].strip())); raw = raw[:m.start()].strip()
    r['alt'] = r['multiAll'] = False
    keep = []
    for line in raw.split('\n'):
        t = line.strip()
        if t.startswith('※'):
            if re.search(r'하나를 쓰면|한 가지만 쓰면', t):
                r['alt'] = True
            if '밑줄' in t:
                r['essay'] = True
            if '모두 적어야' in t:
                r['multiAll'] = True
            continue
        keep.append(line)
    r['answerRaw'] = '\n'.join(keep).strip()
    if extra:
        r['explanation'] = ('\n\n'.join(x for x in extra if x) + ('\n\n' + r['explanation'] if r['explanation'] else '')).strip()


def blank_from(val, alt, label=None):
    """한 빈칸의 허용 답안 구성. alt면 쉼표=대체 답안, 아니면 쉼표 목록=집합(set) 빈칸."""
    val = val.strip()
    parts = split_top_commas(val)
    if len(parts) > 1 and alt:
        acc = []
        for p in parts:
            acc += variants(p)
        return dict(label=label, accept=list(dict.fromkeys(acc)))
    if len(parts) > 1:
        return dict(label=label, accept=[val], set=True)
    return dict(label=label, accept=variants(val))


def build_answer(q):
    raw = q['answerRaw'].strip()
    prompt = q['prompt']
    qid = q['id']
    alt = q.get('alt', False)
    display = raw
    mode = MODE_OVERRIDE.get(qid)
    if not raw and not mode:
        return dict(mode='essay', display='정답은 해설을 참고하세요.', blanks=[], ordered=True, keywords=[])
    circled = bool(re.search(r'(^|\s)[①-⑩]\s*\S', raw)) and not re.fullmatch(r'[①-⑩](\s*,\s*[①-⑩])+', raw.strip())
    if not mode:
        if q.get('essay') or re.search(r'서술하시오|설명하시오|한 문장', prompt):
            mode = 'essay'
        elif SQL_START.match(raw) or (re.search(r'작성하시오', prompt) and len(raw) < 80):
            mode = 'short'
        elif re.search(r'작성하시오', prompt) and not circled:
            mode = 'essay'
        elif circled or re.search(r'계산(식|과정)', raw):
            mode = 'short'
        elif detect_lang(q) in ('C', 'Java', 'Python') and ('실행 결과' in prompt or '출력' in prompt):
            mode = 'output'
        elif '\n' in raw and not alt:
            mode = 'output'   # 여러 줄 결과(표·배열 등)는 줄 단위 정확 비교
        else:
            mode = 'short'
    if mode == 'essay':
        return dict(mode='essay', display=re.sub(r'\s*\n\s*', ' ', display), blanks=[], ordered=True,
                    keywords=q.get('keywords') or [])
    if mode == 'output':
        return dict(mode='output', display=display, blanks=[dict(label=None, accept=[raw])], ordered=True)
    if qid in ANSWER_OVERRIDE:
        return dict(mode='short', display=display, ordered=True,
                    blanks=[dict(label=l, accept=a) for l, a in ANSWER_OVERRIDE[qid]])
    if SQL_START.match(raw):
        stmt = re.sub(r'\s*\n\s*', ' ', raw)
        return dict(mode='short', display=display, ordered=True, blanks=[dict(label='SQL', accept=[stmt])],
                    note='공백·대소문자·따옴표 종류·끝 세미콜론 차이는 무시합니다. 다른 표현도 맞다면 "정답으로 인정"을 누르세요.')
    # 계산식 + 답
    m = re.search(r'•?\s*답\s*:\s*(.+)$', raw, re.M)
    if re.search(r'계산(식|과정)', raw) and m:
        val = m.group(1).strip()
        acc = [val] + ([re.sub(r'[^\d.]+$', '', val)] if re.match(r'^[\d.]+', val) else [])
        return dict(mode='short', display=display, ordered=True, blanks=[dict(label='답', accept=acc)],
                    note='계산식은 채점하지 않고 최종 답만 채점합니다.')
    flat = re.sub(r'\s*\n\s*', ' ', raw).replace('•', ' ').strip()
    # 순서 나열형 (A → D → C → F / ㉠, ㉡, ㉣ / ⑤, ⑥, ③)
    if re.fullmatch(rf'{SEQ_ITEM}(\s*(,|→|->)\s*{SEQ_ITEM})+', flat) and \
            (re.search(r'순서|나열|차례|순으로', prompt) or '→' in flat):
        return dict(mode='short', display=display, ordered=True, blanks=[dict(label=None, accept=[flat], seq=True)],
                    note='순서대로 쓰세요. 구분자(쉼표·화살표·공백)는 자유입니다.')
    # ①②③ 라벨
    if circled:
        items = re.findall(r'([①-⑩])\s*(.+?)(?=\s+[①-⑩]\s*\S|$)', flat)
        blanks = []
        for lab, val in items:
            val = val.strip()
            if ' : ' in val or (val.count(':') == 1 and not re.search(r'\d:\d', val)):
                val = val.split(':')[-1].strip()
            blanks.append(blank_from(val, alt, lab))
        return dict(mode='short', display=display, ordered=True, blanks=blanks)
    # '• 팬인(Fan-In) : 3' 형태
    lines = [l.strip(' •') for l in raw.split('\n') if l.strip(' •')]
    if len(lines) > 1 and all(':' in l for l in lines):
        blanks = [blank_from(l.split(':', 1)[1], alt, l.split(':')[0].strip()) for l in lines]
        return dict(mode='short', display=display, ordered=True, blanks=blanks)
    if alt and not q.get('multiAll') and not re.search(r'\d가지|모두\s*(골라|고르|쓰)', prompt):
        return dict(mode='short', display=display, ordered=True, blanks=[blank_from(flat, True)])
    parts = split_top_commas(flat)
    multi_hint = q.get('multiAll') or re.search(r'\d가지|모두|고르시오|나열|괄호에 들어갈', prompt) or q['body'].count('(') >= 2
    if len(parts) > 1 and all(len(p) < 40 for p in parts) and multi_hint:
        unordered = bool(q.get('multiAll') or re.search(r'\d가지|모두|고르시오', prompt))
        return dict(mode='short', display=display, ordered=not unordered,
                    blanks=[dict(label=None, accept=variants(p)) for p in parts])
    return dict(mode='short', display=display, ordered=True, blanks=[dict(label=None, accept=variants(flat))])


def main():
    raws = []
    for f in sorted(glob.glob('out/raw_*.json')):
        raws += json.load(open(f))
    qs, sets = [], {}
    for r in raws:
        ov = RAW_OVERRIDE.get(r['id'])
        if ov:
            if ov.get('body_suffix') is not None:
                r['body'] = r['body'].split('배열 <field>')[0].rstrip() + '\n\n' + ov['body_suffix']
            r['answerRaw'] = ov.get('answerRaw', r['answerRaw'])
            if 'image' in ov:
                r['image'] = ov['image']
            if ov.get('mode'):
                MODE_OVERRIDE[r['id']] = ov['mode']
        preprocess(r)
        lang = r.get('lang') or (detect_lang(r) if (is_code_q(r) or r.get('source') == 'exam') else None)
        if lang == 'SQL' and not is_code_q(r):
            lang = None
        subject = classify({**r, 'lang': lang if lang not in (None, 'SQL') else None})
        ans = build_answer(r)
        set_id = r['round'] if r.get('round') else r['source']
        q = dict(
            id=r['id'], setId=set_id, number=r['number'],
            subject=subject, lang=lang if subject == '프로그래밍' else None,
            topic=r.get('topic'), points=r.get('points', 5),
            prompt=r['prompt'], body=r['body'],
            image=f"/cert/images/{r['image']}" if r['image'] else None,
            answer=ans, explanation=r['explanation'],
        )
        qs.append(q)
        s = sets.setdefault(set_id, dict(
            id=set_id, kind='exam' if r.get('round') else 'workbook', title=r['sourceTitle'],
            year=int(r['round'].split('-')[0]) if r.get('round') else None,
            session=int(r['round'].split('-')[1]) if r.get('round') else None,
            count=0))
        s['count'] += 1
    os.makedirs('dist/data/cert', exist_ok=True)
    shutil.rmtree('dist/public/cert/images', ignore_errors=True)
    os.makedirs('dist/public/cert/images', exist_ok=True)
    for png in glob.glob('out/images/*.png'):
        shutil.copy(png, 'dist/public/cert/images/')
    sets_l = sorted(sets.values(), key=lambda s: (s['kind'] != 'exam', -(s['year'] or 0), -(s['session'] or 0), s['id']))
    json.dump(qs, open('dist/data/cert/questions.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(dict(subjects=SUBJECTS, sets=sets_l), open('dist/data/cert/sets.json', 'w'), ensure_ascii=False, indent=1)
    from collections import Counter
    print(len(qs), 'questions', Counter(q['subject'] for q in qs))
    print(Counter(q['answer']['mode'] for q in qs))


if __name__ == '__main__':
    main()
