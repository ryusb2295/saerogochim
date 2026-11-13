// 공개 체험 계정에 다양한 인쇄 요청을 한 번씩 추가한다.
// 실행: node scripts/seed_showcase.mjs --apply
// 기존 시연 요청의 미리보기를 워터마크 버전으로 교체: --repair-previews
// 같은 제목이 이미 있으면 요청을 다시 만들지 않아 재실행해도 중복되지 않는다.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = await readFile(join(root, 'config.js'), 'utf8');
const url = config.match(/supabaseUrl: '([^']+)'/)?.[1];
const key = config.match(/supabaseKey: '([^']+)'/)?.[1];
if (!url || !key) throw new Error('config.js의 공개 Supabase 설정을 읽지 못했습니다.');

const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const examples = [
  {
    asset: 'coffee-roastery.png', title: '달빛 로스터리 원두 스티커', item: 'sticker', quantity: 1000,
    width: 60, height: 60, material: '유포지', finishing: ['무광 코팅', '도무송 재단'],
    region_sido: '경북', region_sigungu: '경산시',
    note: '원두 봉투에 붙일 원형 스티커예요. 잉크 색과 재단선을 맞춰 주세요.',
    quote: { unit: 115, shipping: 3500, days: 5, note: '무광 코팅과 원형 도무송을 포함한 가격입니다.' },
    target: 'open'
  },
  {
    asset: 'bakery-bag.png', title: '모락빵집 포장 쇼핑백', item: 'shopping_bag', quantity: 500,
    width: 260, height: 300, material: '크라프트지', finishing: [],
    region_sido: '대구', region_sigungu: '달서구',
    note: '빵 두세 개가 들어갈 크기예요. 손잡이는 종이끈으로 제작하고 싶어요.',
    quote: { unit: 590, shipping: 6000, days: 9, note: '크라프트지와 종이끈 손잡이 제작을 포함합니다.' },
    target: 'accepted'
  },
  {
    asset: 'florist-wrap.png', title: '꽃담 플라워 꽃다발 포장지', item: 'wrapping', quantity: 1500,
    width: 500, height: 700, material: '아트지', finishing: ['무광 코팅'],
    region_sido: '대구', region_sigungu: '수성구',
    note: '꽃다발 포장에 쓸 부드러운 종이를 찾고 있어요. 접었을 때 잉크가 갈라지지 않으면 좋겠어요.',
    quote: null, target: 'open'
  },
  {
    asset: 'soap-label.png', title: '푸른숲 수제비누 라벨', item: 'sticker', quantity: 800,
    width: 80, height: 50, material: '유포지', finishing: ['무광 코팅'],
    region_sido: '대구', region_sigungu: '중구',
    note: '욕실에서 쓰는 제품이라 물에 강한 라벨이 필요해요. 작은 글씨도 선명하게 인쇄해 주세요.',
    quote: { unit: 160, shipping: 4000, days: 6, note: '방수 유포지와 무광 코팅으로 제작합니다.' },
    target: 'in_progress'
  },
  {
    asset: 'pet-treats.png', title: '꼬리별 반려견 간식 스티커', item: 'sticker', quantity: 1200,
    width: 70, height: 70, material: '아트지', finishing: ['도무송 재단'],
    region_sido: '경북', region_sigungu: '경산시',
    note: '간식 지퍼백 앞면에 붙일 스티커예요. 색감이 따뜻하게 나오면 좋겠습니다.',
    quote: { unit: 95, shipping: 3500, days: 4, note: '지퍼백에 붙이기 좋은 점착지로 제작합니다.' },
    target: 'open'
  }
];

async function api(path, { method = 'GET', token, body, type = 'application/json', prefer } = {}) {
  const headers = { apikey: key };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = type;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(url + path, { method, headers, body: body === undefined ? undefined : type === 'application/json' ? JSON.stringify(body) : body });
  const content = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${content}`);
  return content ? JSON.parse(content) : null;
}

async function login(name, password) {
  return api('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email: `${name}@users.gageon.invalid`, password }
  });
}

const apply = process.argv.includes('--apply');
const repairPreviews = process.argv.includes('--repair-previews');
if (!apply && !repairPreviews) {
  console.log(`${examples.length}개 예시 준비됨. 추가는 --apply, 미리보기 복구는 --repair-previews를 붙이세요.`);
  process.exit(0);
}

const owner = await login('demo', process.env.DEMO_OWNER_PASSWORD || 'demo1234');
const ownerToken = owner.access_token;
const ownerId = owner.user.id;
const current = await api(`/rest/v1/print_requests?select=id,title,status,preview_path&owner_id=eq.${ownerId}`, { token: ownerToken });
const requests = new Map(current.map(row => [row.title, row]));

for (const example of examples) {
  if (requests.has(example.title)) {
    if (repairPreviews) {
      const path = requests.get(example.title).preview_path;
      const preview = await readFile(join(root, 'assets', 'demo', 'previews', example.asset));
      await api('/storage/v1/object/request-previews', {
        method: 'DELETE', token: ownerToken, body: { prefixes: [path] }
      });
      try {
        await api(`/storage/v1/object/request-previews/${path}`, {
          method: 'POST', token: ownerToken, body: preview, type: 'image/png'
        });
      } catch (error) {
        const original = await readFile(join(root, 'assets', 'demo', example.asset));
        await api(`/storage/v1/object/request-previews/${path}`, {
          method: 'POST', token: ownerToken, body: original, type: 'image/png'
        });
        throw error;
      }
      console.log(`워터마크 미리보기 교체: ${example.title}`);
    }
    console.log(`유지: ${example.title}`);
    continue;
  }
  if (!apply) continue;
  const id = randomUUID();
  const image = await readFile(join(root, 'assets', 'demo', example.asset));
  const preview = await readFile(join(root, 'assets', 'demo', 'previews', example.asset));
  const designPath = `${ownerId}/${id}/original.png`;
  const previewPath = `${ownerId}/${id}.png`;
  await api(`/storage/v1/object/request-files/${designPath}`, { method: 'POST', token: ownerToken, body: image, type: 'image/png' });
  await api(`/storage/v1/object/request-previews/${previewPath}`, { method: 'POST', token: ownerToken, body: preview, type: 'image/png' });
  const row = await api('/rest/v1/print_requests', {
    method: 'POST', token: ownerToken, prefer: 'return=representation',
    body: {
      id, owner_id: ownerId, title: example.title, item: example.item,
      quantity: example.quantity, width: example.width, height: example.height, unit: 'mm',
      material: example.material, finishing: example.finishing,
      due_date: day(26), quote_deadline: `${day(10)}T14:59:00Z`,
      region_sido: example.region_sido, region_sigungu: example.region_sigungu,
      note: example.note, design_path: designPath, preview_path: previewPath
    }
  });
  requests.set(example.title, row[0]);
  console.log(`추가: ${example.title}`);
}

if (!apply) {
  console.log('시연 미리보기 교체 완료');
  process.exit(0);
}

const printer = await login('demoprint', process.env.DEMO_PRINTER_PASSWORD || 'demo1234');
const sent = await api('/rest/v1/quotations?select=id,request_id,status', { token: printer.access_token });
const sentByRequest = new Map(sent.map(row => [row.request_id, row]));
for (const example of examples.filter(x => x.quote)) {
  const req = requests.get(example.title);
  if (req.status === 'open') {
    const existing = sentByRequest.get(req.id);
    const quotationId = existing?.status === 'submitted' ? existing.id : await api('/rest/v1/rpc/submit_quotation', {
      method: 'POST', token: printer.access_token,
      body: {
        p_request: req.id, p_unit_price: example.quote.unit, p_quantity: example.quantity,
        p_shipping_fee: example.quote.shipping, p_production_days: example.quote.days,
        p_delivery_date: day(20), p_note: example.quote.note
      }
    });
    if (example.target !== 'open') {
      await api('/rest/v1/rpc/accept_quotation', { method: 'POST', token: ownerToken, body: { p_quote: quotationId } });
      req.status = 'accepted';
    }
  }
  if (example.target === 'in_progress' && req.status === 'accepted') {
    await api('/rest/v1/rpc/advance_request', {
      method: 'POST', token: printer.access_token,
      body: { p_request: req.id, p_status: 'in_progress' }
    });
    req.status = 'in_progress';
  }
  console.log(`상태: ${example.title} → ${req.status}`);
}
console.log('체험 계정 예시 데이터 준비 완료');
