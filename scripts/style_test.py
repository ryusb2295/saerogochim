"""시디과 화풍(assets/styles)별로 OpenAI 캐릭터를 뽑아 한 페이지에서 비교한다.

사용법 (저장소 폴더에서):
    python scripts/style_test.py                  # 예시 가게 3곳 x 화풍 4개 x 1장 = 12장
    python scripts/style_test.py briefs.json -n 2 --styles duck,object

키는 OPENAI_API_KEY 환경변수나 실행 중 입력으로 받고 파일에 저장하지 않는다.
결과는 compare/styles-<시각>/index.html (저장소에는 안 올라감).
"""
import argparse
import base64
import getpass
import html
import json
import os
import sys
import time
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import server  # noqa: E402  실제 서비스와 같은 프롬프트, 참고 이미지, 호출을 쓴다
from compare_images import SAMPLE_BRIEFS  # noqa: E402


def page(rows, styles):
    head = ''.join(f'<th>{s}<small>{html.escape(server.STYLES[s][0])}</small></th>' for s in styles)
    body = ''
    for brief, cells in rows:
        tds = ''.join('<td>' + ''.join(f'<img src="{html.escape(f)}">' for f in cells.get(s, [])) + '</td>' for s in styles)
        body += f'<tr><th>{html.escape(brief["name"])}<small>{html.escape(brief["industry"])} / {html.escape(brief["mood"])}</small></th>{tds}</tr>'
    return ('<!doctype html><meta charset="utf-8"><title>화풍 테스트</title><style>'
            'body{font-family:sans-serif;margin:24px;background:#f7f5ef}table{border-collapse:collapse}'
            'th,td{padding:8px;vertical-align:top;text-align:center}th small{display:block;font-weight:400;font-size:11px;max-width:220px;color:#777}'
            'img{width:200px;height:200px;object-fit:contain;background:#fff;border-radius:12px;margin:2px}</style>'
            f'<h1>화풍 테스트</h1><table><tr><th></th>{head}</tr>{body}</table>')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('briefs', nargs='?', help='가게 정보 JSON 파일 (없으면 예시 3곳)')
    parser.add_argument('-n', type=int, default=1, help='칸마다 뽑을 장수 (기본 1)')
    parser.add_argument('--styles', default=','.join(server.STYLES), help='쉼표로 구분 (기본: 전부)')
    args = parser.parse_args()
    styles = [s for s in args.styles.split(',') if s in server.STYLES]
    briefs = [server.validate(b) for b in (json.loads(Path(args.briefs).read_text(encoding='utf-8')) if args.briefs else SAMPLE_BRIEFS)]
    if not styles:
        sys.exit(f'화풍 이름을 확인해주세요: {", ".join(server.STYLES)}')

    server.API_KEY = os.environ.get('OPENAI_API_KEY', '').strip() or getpass.getpass('OpenAI API key (안 보임): ').strip()
    if not server.API_KEY:
        sys.exit('키가 없어서 끝냅니다.')
    calls = len(briefs) * len(styles) * args.n
    if input(f'이미지 생성 요청을 {calls}번 보냅니다 (1장에 대략 30~45원). 계속할까요? (y/N) ').strip().lower() != 'y':
        sys.exit('취소했어요.')

    out = ROOT / 'compare' / time.strftime('styles-%Y%m%d-%H%M%S')
    out.mkdir(parents=True)
    rows = []
    for bi, brief in enumerate(briefs):
        cells = {}
        for style in styles:
            for k in range(args.n):
                fname = f'{bi + 1}_{style}_{k + 1}.png'
                started = time.time()
                try:
                    result = server.generate(dict(brief, style=style))
                    (out / fname).write_bytes(base64.b64decode(result['image'].split(',', 1)[1]))
                    cells.setdefault(style, []).append(fname)
                    print(f'저장 {fname} ({time.time() - started:.0f}초)')
                except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as error:
                    detail = error.read().decode(errors='replace')[:300] if isinstance(error, urllib.error.HTTPError) else error
                    print(f'실패 {fname}: {detail}')
        rows.append((brief, cells))
        (out / 'index.html').write_text(page(rows, styles), encoding='utf-8')   # 중간에 끊겨도 그때까지 결과는 남는다
    print(f'완료: {out / "index.html"}')


if __name__ == '__main__':
    main()
