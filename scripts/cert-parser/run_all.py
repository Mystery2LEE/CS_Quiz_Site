"""PDF 폴더를 통째로 문제은행으로 변환.

usage:
  pip install -r requirements.txt
  python run_all.py <PDF 폴더> [--out <프로젝트 루트>]

- 파일명 규칙(시나공 자료 기준)으로 형식을 자동 판별합니다.
    · '정답 및 해설' 페이지가 있으면 → 기출 회차형 (파일명에서 'YYYY년 N회' 추출, id 예: 2020-1)
    · 아니면 → 워크북형 (파일명 '_07_' 같은 번호로 id 예: wb07, 제목은 파일명에서 추출)
- 결과: <out>/data/cert/questions.json, sets.json, <out>/public/cert/images/*.png
- 파싱 경고(정답 누락, 문항 수 이상 등)는 콘솔에 출력됩니다. 경고가 있으면 build.py 의
  SUBJECT_OVERRIDE / ANSWER_OVERRIDE / MODE_OVERRIDE 로 보정하세요.
"""
import sys, os, re, json, glob, shutil, argparse, unicodedata
import pdfplumber
import parse_workbook, parse_exam, build


def detect(pdf_path):
    if re.search(r'\d{4}\s*년\s*\d+\s*회', unicodedata.normalize('NFC', os.path.basename(pdf_path))):
        return 'exam'
    with pdfplumber.open(pdf_path) as pdf:
        for pg in pdf.pages:
            if '정답 및 해설' in (pg.extract_text() or ''):
                return 'exam'
    return 'workbook'


def workbook_meta(name):
    m = re.search(r'_(\d{2})_(.+)$', name)
    num = m.group(1) if m else re.sub(r'\W+', '', name)[:8]
    title = (m.group(2) if m else name).replace('_', ' ').replace('-', ' - ')
    title = re.sub(r'(\d+)문제$', r' \1제', title).strip()
    lang = None
    for key, l in [('JAVA', 'Java'), ('Java', 'Java'), ('C언어', 'C'), ('Python', 'Python'), ('파이썬', 'Python')]:
        if key in name:
            lang = l
    cat = 'SQL' if 'SQL' in name else ('프로그래밍' if (lang or '코드' in name) else '이론')
    return f'wb{num}', title, cat, lang


def exam_meta(name):
    m = re.search(r'(\d{4})\s*년\s*(\d+)\s*회', name)
    if not m:
        raise ValueError(f'파일명에서 연도/회차를 찾을 수 없음: {name}')
    y, s = m.group(1), m.group(2)
    label = '·'.join(s) if len(s) > 1 else s   # '45' → '4·5' (통합 회차)
    return f'{y}-{s}', f'{y}년 {label}회 정보처리기사 실기'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_dir')
    ap.add_argument('--out', default='dist')
    a = ap.parse_args()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    shutil.rmtree('out', ignore_errors=True)
    os.makedirs('out', exist_ok=True)
    pdfs = sorted(glob.glob(os.path.join(a.pdf_dir, '*.pdf')))
    if not pdfs:
        sys.exit('PDF가 없습니다')
    for p in pdfs:
        name = unicodedata.normalize('NFC', os.path.splitext(os.path.basename(p))[0])
        kind = detect(p)
        try:
            if kind == 'exam':
                rid, title = exam_meta(name)
                qs = parse_exam.parse(p, rid, title)
                sid = rid
            else:
                sid, title, cat, lang = workbook_meta(name)
                qs = parse_workbook.parse(p, sid, title, cat, lang)
            json.dump(qs, open(f'out/raw_{sid}.json', 'w'), ensure_ascii=False, indent=1)
            warn = [q['id'] for q in qs if not q['answerRaw'].strip()]
            print(f'[{kind:8}] {name} → {sid}: {len(qs)}문항, 그림 {sum(1 for q in qs if q["image"])}개'
                  + (f'  ⚠ 정답 비어 있음: {warn}' if warn else ''))
            if kind == 'exam' and len(qs) != 20:
                print(f'  ⚠ 기출 문항 수가 20이 아님 ({len(qs)})')
        except Exception as e:
            print(f'[실패] {name}: {e}')
    build.main()
    for sub in ['data/cert', 'public/cert/images']:
        dst = os.path.join(a.out, sub)
        if os.path.abspath(a.out) != os.path.abspath('dist'):
            shutil.rmtree(dst, ignore_errors=True)
            shutil.copytree(os.path.join('dist', sub), dst)
    print('완료 →', os.path.abspath(a.out))


if __name__ == '__main__':
    main()
