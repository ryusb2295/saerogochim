"""소상공인시장진흥공단 상가(상권)정보 zip에서 경산시 가게만 뽑아 data/gyeongsan-stores.json을 만든다.

사용법: python scripts/build_stores.py <상가(상권)정보_YYYYMMDD.zip>
원본: https://www.data.go.kr/data/15083033/fileData.do (분기마다 갱신)
"""
import csv, io, json, re, sys, zipfile
from pathlib import Path

CITY = ('경상북도', '경산시')
OUT = Path(__file__).resolve().parent.parent / 'data' / 'gyeongsan-stores.json'


def main(zip_path):
    z = zipfile.ZipFile(zip_path)
    dongs, cats, rows = {}, {}, []
    month = ''
    for info in z.infolist():
        if not info.filename.endswith('.csv'):
            continue
        with z.open(info) as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig'))
            first = next(reader, None)
            if not first or first['시도명'] != CITY[0]:
                continue
            month = re.search(r'_(\d{6})\.csv$', info.filename).group(1)
            for r in [first, *reader]:
                if r['시군구명'] != CITY[1]:
                    continue
                d = dongs.setdefault(r['행정동명'].strip(), len(dongs))
                key = (r['상권업종대분류명'].strip(), r['상권업종중분류명'].strip(), r['상권업종소분류명'].strip())
                c = cats.setdefault(key, len(cats))
                rows.append([d, c, r['상호명'].strip()])
    assert rows, '경산시 데이터를 찾지 못했어요. zip 파일을 확인해주세요.'
    data = {
        'source': '소상공인시장진흥공단 상가(상권)정보',
        'month': f'{month[:4]}.{month[4:]}',
        'city': ' '.join(CITY),
        'dongs': list(dongs),
        'cats': [list(k) for k in cats],
        'rows': rows,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(rows)}곳, 행정동 {len(dongs)}개, 업종 {len(cats)}개 -> {OUT} ({OUT.stat().st_size // 1024}KB)')


if __name__ == '__main__':
    main(sys.argv[1])
