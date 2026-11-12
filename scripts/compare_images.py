"""같은 가게 정보로 OpenAI와 Gemini 캐릭터를 뽑아 이름을 가린 비교 페이지를 만든다.

사용법 (저장소 폴더에서):
    python scripts/compare_images.py            # 기본 예시 가게 3곳, 서비스마다 2장씩
    python scripts/compare_images.py briefs.json -n 3

briefs.json 형식: [{"name": "달빛분식", "industry": "떡볶이 분식집", "mood": "귀엽고 친근한",
                   "audience": "청년", "feature": "국물 떡볶이"}, ...]
키는 OPENAI_API_KEY, GEMINI_API_KEY 환경변수나 실행 중 입력으로 받고 파일에 저장하지 않는다.
결과는 compare/<시각>/ 에 저장된다. index.html은 A/B로만 보여주고, 정답은 key.json에 있다.
"""
import argparse
import base64
import getpass
import html
import json
import os
import random
import secrets
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import server  # noqa: E402  같은 프롬프트(prompt_for)와 OpenAI 호출(generate)을 그대로 쓴다

GEMINI_MODEL = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-nano-banana-2.1')
SAMPLE_BRIEFS = [
    {'name': '달빛분식', 'industry': '떡볶이 분식집', 'mood': '귀엽고 친근한', 'audience': '청년', 'feature': '밤늦게까지 여는 국물 떡볶이'},
    {'name': '봄날커피', 'industry': '동네 카페', 'mood': '고급스럽고 차분한', 'audience': '전 연령', 'feature': '직접 로스팅한 원두'},
    {'name': '꽃담', 'industry': '꽃집', 'mood': '재미있고 개성 있는', 'audience': '청년', 'feature': '기념일 꽃다발 당일 제작'},
]


def openai_image(brief, key):
    server.API_KEY = key
    return base64.b64decode(server.generate(brief)['image'].split(',', 1)[1])


def find_image(node):
    """Gemini 응답 JSON 어디에 있든 첫 이미지의 base64를 찾는다 (interactions, generateContent 둘 다)."""
    if isinstance(node, dict):
        inline = node.get('inlineData') or node.get('inline_data')
        if isinstance(inline, dict) and inline.get('data'):
            return inline['data']
        if node.get('type') == 'image' and isinstance(node.get('data'), str):
            return node['data']
        node = list(node.values())
    if isinstance(node, list):
        for item in node:
            found = find_image(item)
            if found:
                return found
    return None


def gemini_image(brief, key):
    body = {'model': GEMINI_MODEL, 'input': [{'type': 'text', 'text': server.prompt_for(brief)}],
            'response_format': {'type': 'image', 'mime_type': 'image/png', 'aspect_ratio': '1:1', 'image_size': '1K'}}
    request = urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/interactions',
        data=json.dumps(body).encode(), method='POST',
        headers={'x-goog-api-key': key, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20'})
    with urllib.request.urlopen(request, timeout=180) as response:
        data = find_image(json.loads(response.read()))
    if not data:
        raise ValueError('응답에서 이미지를 찾지 못했어요.')
    return base64.b64decode(data)


PROVIDERS = {'OpenAI': ('OPENAI_API_KEY', openai_image), 'Gemini': ('GEMINI_API_KEY', gemini_image)}


def blind_page(rows):
    """rows: [(brief, [(label, filename), ...])] -> 서비스 이름 없이 A, B만 보이는 비교 페이지."""
    cards = []
    for brief, shots in rows:
        imgs = ''.join(f'<figure><img src="{html.escape(f)}"><figcaption>{l}</figcaption></figure>' for l, f in shots)
        cards.append(f'<section><h2>{html.escape(brief["name"])} · {html.escape(brief["industry"])}</h2>'
                     f'<p>{html.escape(brief["mood"])} / {html.escape(brief.get("feature", ""))}</p><div>{imgs}</div></section>')
    return ('<!doctype html><meta charset="utf-8"><title>캐릭터 비교</title><style>'
            'body{font-family:sans-serif;margin:24px;background:#f7f5ef}section{margin-bottom:32px}'
            'div{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;background:#fff;padding:8px;border-radius:12px}'
            'img{width:220px;height:220px;object-fit:contain}figcaption{text-align:center;font-weight:700}</style>'
            '<h1>어느 쪽이 더 마음에 드나요?</h1><p>서비스 이름은 가려져 있어요. 가게마다 고른 글자를 적어주세요.</p>' + ''.join(cards))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('briefs', nargs='?', help='가게 정보 JSON 파일 (없으면 예시 3곳)')
    parser.add_argument('-n', type=int, default=2, help='가게마다 서비스별로 뽑을 장수 (기본 2)')
    args = parser.parse_args()
    briefs = [server.validate(b) for b in (json.loads(Path(args.briefs).read_text(encoding='utf-8')) if args.briefs else SAMPLE_BRIEFS)]

    keys = {}
    for name, (env, _) in PROVIDERS.items():
        key = os.environ.get(env, '').strip() or getpass.getpass(f'{name} API key (안 보임, 건너뛰려면 Enter): ').strip()
        if key:
            keys[name] = key
    if not keys:
        sys.exit('키가 하나도 없어서 끝냅니다.')
    calls = len(briefs) * args.n * len(keys)
    if input(f'{", ".join(keys)}에 이미지 생성 요청을 {calls}번 보냅니다. 요금이 나와요. 계속할까요? (y/N) ').strip().lower() != 'y':
        sys.exit('취소했어요.')

    out = ROOT / 'compare' / time.strftime('%Y%m%d-%H%M%S')
    out.mkdir(parents=True)
    rows, answer = [], {}
    for bi, brief in enumerate(briefs):
        shots = []
        for name, key in keys.items():
            for _ in range(args.n):
                fname = f'{bi + 1}_{secrets.token_hex(4)}.png'  # 파일 이름으로 서비스가 드러나지 않게
                try:
                    (out / fname).write_bytes(PROVIDERS[name][1](brief, key))
                    shots.append((name, fname))
                    print('저장', fname)
                except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as error:
                    detail = error.read().decode(errors='replace')[:300] if isinstance(error, urllib.error.HTTPError) else error
                    print(f'실패 {fname}: {detail}')
        random.shuffle(shots)
        labeled = []
        for j, (name, fname) in enumerate(shots):
            label = chr(65 + j)
            answer[f'{brief["name"]} {label}'] = f'{name} ({fname})'
            labeled.append((label, fname))
        rows.append((brief, labeled))
    (out / 'index.html').write_text(blind_page(rows), encoding='utf-8')
    (out / 'key.json').write_text(json.dumps(answer, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'완료: {out / "index.html"} (정답은 key.json, 고르기 전에는 열지 마세요)')


if __name__ == '__main__':
    main()
