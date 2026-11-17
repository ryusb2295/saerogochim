// 가게온 SQL 검증: Supabase 없이 PGlite(브라우저/Node용 Postgres)로 스키마, RLS, 함수를 시험한다.
// 실행: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/test_rls.mjs
// shortcut: auth, storage 스키마는 Supabase 동작을 흉내 낸 최소 버전이다. 실제 프로젝트에서도 같은 시나리오를 한 번 더 확인할 것.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : '@electric-sql/pglite');
const db = new PGlite();
const dir = new URL('.', import.meta.url);
const sql = f => readFileSync(new URL(f, dir), 'utf8');

// Supabase가 기본으로 깔아 두는 것들의 최소 흉내
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
grant usage on schema public, auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant all on storage.objects to authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
for (const f of ['01_schema.sql', '02_policies.sql', '03_functions.sql', '04_storage_realtime.sql', '06_printer_lists.sql', '07_admin.sql', '08_launch.sql', '09_bizno.sql']) await db.exec(sql(f));
// pg_net 흉내: 보낸 요청을 표에 쌓아 두고 확인한다
await db.exec(`create schema net; create table net.sent (url text, body jsonb);
create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as $$ insert into net.sent values (url, body); select 1::bigint $$;`);
await db.exec(sql('10_push.sql').replace('create extension if not exists pg_net;', ''));
await db.exec(sql('12_chat_notify.sql'));
await db.exec(sql('13_ai_access.sql'));

let failed = 0;
const ok = (cond, label) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) failed++; };
// 사용자로 행동: 역할을 authenticated로 바꾸고 auth.uid()를 지정
async function as(uid, q, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return await db.query(q, params); } finally { await db.exec('reset role;'); }
}
async function fails(uid, q, params, label, msg) {
  try { await as(uid, q, params); ok(false, label + ' (막히지 않음)'); }
  catch (e) { ok(!msg || String(e.message).includes(msg), label + (msg ? ` [${msg}]` : '') + (msg && !String(e.message).includes(msg) ? ' got: ' + e.message : '')); }
}
async function signup(username, role, extra = {}) {
  const r = await db.query(`insert into auth.users (raw_user_meta_data) values ($1) returning id`,
    [JSON.stringify({ username, role, display_name: username, ...extra })]);
  return r.rows[0].id;
}

// 가입
const A = await signup('owner01', 'owner');
const B = await signup('printer01', 'printer', { shop_name: '비인쇄' });
const C = await signup('printer02', 'printer', { shop_name: '씨인쇄' });
const D = await signup('printer03', 'printer', { shop_name: '미승인' });
await db.exec(sql('05_demo_seed.sql'));
ok((await db.query(`select count(*)::int n from print_shops where verified`)).rows[0].n === 2, 'T2 시연 인쇄소 2곳만 verified');
ok((await as(null, `select username_available('owner01') v`)).rows[0].v === false, '아이디 중복 확인: 있는 아이디');
ok((await as(null, `select username_available('newid') v`)).rows[0].v === true, '아이디 중복 확인: 없는 아이디');
await fails(null, `select * from print_requests`, [], '로그인 안 하면 테이블 조회 불가');
let role = await as(A, `select role from profiles where id = $1`, [A]);
ok(role.rows[0].role === 'owner', 'T1 소상공인 역할 기록');
await fails(A, `update profiles set role = 'printer' where id = $1`, [A], '역할 변경 불가');
await fails(B, `update print_shops set verified = true where owner_id = $1`, [B], 'verified 스스로 변경 불가');
await fails(A, `select username from profiles`, [], '다른 사람 아이디(username) 조회 불가');

// 제작 요청
const req = '11111111-1111-1111-1111-111111111111';
const insertReq = (uid, path = uid) => as(uid, `insert into print_requests (id, owner_id, title, item, quantity, width, height, unit, material,
  due_date, quote_deadline, region_sido, region_sigungu, design_path, preview_path)
  values ($1, $2, '한우랑 스티커', 'sticker', 500, 50, 50, 'mm', '아트지', current_date + 10, now() + interval '3 days', '대구', '북구',
  $3 || '/${req}/original.png', $3 || '/${req}.webp')`, [req, uid, path]);
await fails(B, `insert into print_requests (owner_id, title, item, quantity, width, height, unit, material, due_date, quote_deadline,
  region_sido, region_sigungu, design_path, preview_path) values ($1,'x','sticker',1,1,1,'mm','a',current_date+5,now()+interval '1 day','a','b',$1||'/a',$1||'/b')`,
  [B], '인쇄소는 제작 요청 불가');
await fails(A, `insert into print_requests (owner_id, title, item, quantity, width, height, unit, material, due_date, quote_deadline,
  region_sido, region_sigungu, design_path, preview_path) values ($1,'x','sticker',1,1,1,'mm','a',current_date+5,now()+interval '1 day','a','b','other/a','other/b')`,
  [A], '남의 폴더 파일 경로로 요청 불가');
await insertReq(A);
ok(true, 'T5 소상공인 요청 등록');
await db.exec(`insert into storage.objects (bucket_id, name) values ('request-files', '${A}/${req}/original.png'), ('request-previews', '${A}/${req}.webp')`);

// 공개 목록
const list = await as(B, `select * from list_open_requests()`);
ok(list.rows.length === 1 && !('owner_id' in list.rows[0]) && !('design_path' in list.rows[0]), 'T5 인쇄소 목록에 요청 1건, 소상공인 id와 원본 경로 없음');
await fails(D, `select * from list_open_requests()`, [], '미승인 인쇄소는 목록 불가', 'not_verified_printer');
await fails(A, `select * from list_open_requests()`, [], '소상공인은 공개 목록 불가', 'not_verified_printer');
ok((await as(B, `select * from print_requests`)).rows.length === 0, '인쇄소는 요청 테이블 직접 조회 불가');
ok((await as(B, `select * from storage.objects where bucket_id = 'request-previews'`)).rows.length === 1, '인쇄소는 열린 요청 미리보기 조회 가능');
ok((await as(B, `select * from storage.objects where bucket_id = 'request-files'`)).rows.length === 0, 'T8 수락 전 인쇄소는 원본 파일 불가');

// 견적
const qB = (await as(B, `select submit_quotation($1, 120, 500, 3000, 5, current_date + 8, '무광 코팅 포함') id`, [req])).rows[0].id;
const qC = (await as(C, `select submit_quotation($1, 100, 500, 4000, 7, current_date + 9) id`, [req])).rows[0].id;
ok((await as(B, `select total_price from quotations where id = $1`, [qB])).rows[0].total_price === 60000, '총액은 서버가 단가 × 수량으로 계산');
await fails(D, `select submit_quotation($1, 1, 1, 0, 1, current_date + 1)`, [req], '미승인 인쇄소 견적 불가', 'not_verified_printer');
await fails(B, `insert into quotations (request_id, shop_id, unit_price, quantity, total_price, production_days, delivery_date)
  select $1, id, 1, 1, 1, 1, current_date from print_shops where owner_id = $2`, [req, B], '견적 테이블 직접 쓰기 불가');
await fails(B, `update quotations set status = 'accepted' where id = $1`, [qB], '견적 상태 직접 변경 불가');
ok((await as(B, `select * from quotations`)).rows.length === 1, 'T7 인쇄소는 자기 견적만 보임 (다른 업체 금액 불가)');
ok((await as(A, `select * from quotations`)).rows.length === 2, 'T6 소상공인은 견적 2개 비교 가능');
ok((await as(A, `select count(*)::int n from notifications where type = 'quote_received'`)).rows[0].n === 2, 'T6 새 견적 알림 2개');
await as(B, `select submit_quotation($1, 110, 500, 3000, 5, current_date + 8)`, [req]);
ok((await as(A, `select count(*)::int n from notifications where type = 'quote_received'`)).rows[0].n === 2, '견적 수정은 알림 중복 없음');

const mq = await as(B, `select * from my_quotes()`);
ok(mq.rows.length === 1 && mq.rows[0].title === '한우랑 스티커', 'my_quotes: 자기 견적과 요청 제목만');
ok((await as(A, `select * from my_quotes()`)).rows.length === 0, 'my_quotes: 소상공인은 빈 목록');

// 수락
await fails(B, `select accept_quotation($1)`, [qB], '인쇄소는 수락 불가', 'forbidden');
const conv = (await as(A, `select accept_quotation($1) id`, [qB])).rows[0].id;
ok(!!conv, 'T10 수락 후 채팅방 생성');
await fails(A, `select accept_quotation($1)`, [qC], 'T9 두 번째 수락은 거부', 'already_closed');
const st = await db.query(`select (select status from print_requests where id = $1) r,
  (select status from quotations where id = $2) b, (select status from quotations where id = $3) c,
  (select count(*)::int from conversations) n`, [req, qB, qC]);
ok(st.rows[0].r === 'accepted' && st.rows[0].b === 'accepted' && st.rows[0].c === 'declined' && st.rows[0].n === 1,
  'T10 요청 accepted, B accepted, C declined, 채팅방 1개');
ok((await as(B, `select count(*)::int n from notifications where type = 'quote_accepted'`)).rows[0].n === 1, 'T10 B에게 수락 알림');
ok((await as(C, `select count(*)::int n from notifications where type = 'quote_declined'`)).rows[0].n === 1, 'C에게 거절 알림');
ok((await as(B, `select * from print_requests`)).rows.length === 1, '수락된 인쇄소는 요청 상세 조회 가능');
ok((await as(B, `select * from storage.objects where bucket_id = 'request-files'`)).rows.length === 1, 'T13 수락 후 인쇄소 원본 파일 조회 가능');
ok((await as(C, `select * from storage.objects where bucket_id = 'request-files'`)).rows.length === 0, '탈락 업체는 원본 파일 불가');
ok((await as(C, `select * from storage.objects where bucket_id = 'request-previews'`)).rows.length === 0, '마감된 요청 미리보기는 탈락 업체 불가');
ok((await as(C, `select * from list_open_requests()`)).rows.length === 0, '수락된 요청은 공개 목록에서 빠짐');

// 채팅
await as(A, `insert into messages (conversation_id, sender_id, client_id, body) values ($1, $2, gen_random_uuid(), '안녕하세요')`, [conv, A]);
await as(B, `insert into messages (conversation_id, sender_id, client_id, body) values ($1, $2, '22222222-2222-2222-2222-222222222222', '네 확인했어요')`, [conv, B]);
await fails(B, `insert into messages (conversation_id, sender_id, client_id, body) values ($1, $2, '22222222-2222-2222-2222-222222222222', '네 확인했어요')`,
  [conv, B], 'T12 같은 client_id 재전송은 중복 저장 안 됨');
await fails(C, `insert into messages (conversation_id, sender_id, client_id, body) values ($1, $2, gen_random_uuid(), '끼어들기')`, [conv, C], 'T11 제3자 전송 불가');
ok((await as(C, `select * from messages`)).rows.length === 0, 'T11 제3자 메시지 조회 불가');
const chatNoti = (await as(B, `select title, ref_id from notifications where type = 'message'`)).rows;
ok(chatNoti.length === 1 && chatNoti[0].title.endsWith(': 안녕하세요') && chatNoti[0].ref_id === req, '채팅이 오면 상대방에게 메시지 알림');
ok((await as(A, `select title from notifications where type = 'message'`)).rows.map(r => r.title).join('|') === '비인쇄: 네 확인했어요', '인쇄소가 보내면 업체명으로 알림, 보낸 사람은 알림 안 받음');
await fails(A, `insert into messages (conversation_id, sender_id, client_id, body) values ($1, $2, gen_random_uuid(), '사칭')`, [conv, B], '다른 사람 이름으로 전송 불가');
let mc = await as(A, `select * from my_conversations()`);
ok(mc.rows.length === 1 && Number(mc.rows[0].unread) === 1 && mc.rows[0].other_name === 'printer01', '채팅 목록: 상대 이름, 안 읽은 1개');
await as(A, `select mark_read($1)`, [conv]);
mc = await as(A, `select * from my_conversations()`);
ok(Number(mc.rows[0].unread) === 0, '읽음 처리 후 안 읽은 0개');
ok((await as(C, `select * from my_conversations()`)).rows.length === 0, '제3자 채팅 목록 비어 있음');

// 진행 상태
await fails(A, `select advance_request($1, 'in_progress')`, [req], '소상공인은 제작 중으로 못 바꿈', 'invalid_transition');
await as(B, `select advance_request($1, 'in_progress')`, [req]);
await as(B, `select advance_request($1, 'delivered')`, [req]);
await as(A, `select advance_request($1, 'completed')`, [req]);
ok((await db.query(`select status from print_requests where id = $1`, [req])).rows[0].status === 'completed', '진행: 제작 중 → 납품 → 완료');

// AI 횟수 (13_ai_access.sql: 기본은 꺼짐, 관리자만 켬)
await fails(A, `select consume_ai('image', 3)`, [], 'AI 꺼진 계정은 생성 불가', 'ai_disabled');
await fails(A, `update profiles set ai_enabled = true where id = $1`, [A], '본인이 AI 사용을 직접 켤 수 없음');
ok((await as(A, `select my_ai_enabled() v`)).rows[0].v === false, '내 AI 사용 여부: 꺼짐');
await db.query(`update profiles set ai_enabled = true where id = $1`, [A]);
ok((await as(A, `select my_ai_enabled() v`)).rows[0].v === true, '내 AI 사용 여부: 켜짐');
for (let i = 0; i < 3; i++) await as(A, `select consume_ai('image', 3)`);
await fails(A, `select consume_ai('image', 3)`, [], 'AI 하루 한도 초과 차단', 'ai_limit');
await fails(A, `insert into ai_usage (user_id, kind, used) values ($1, 'image', -100)`, [A], 'AI 사용량 직접 조작 불가');

// 기타
await fails(C, `select notify($1, 'message', null, 'spam')`, [A], '알림 함수 직접 호출 불가');
ok((await as(A, `select * from notifications where user_id <> $1`, [A])).rows.length === 0, '남의 알림 조회 불가');

// 관리자 승인, 브랜드 저장 (08_launch.sql)
const ADM = await signup('boss01', 'owner');
await db.query(`update profiles set role = 'admin' where id = $1`, [ADM]);
await fails(A, `select admin_set_verified($1, true)`, [D], '일반 회원은 인쇄소 승인 불가', 'forbidden');
await as(ADM, `select admin_set_verified($1, true)`, [D]);
ok((await db.query(`select verified from print_shops where owner_id = $1`, [D])).rows[0].verified === true, '관리자가 인쇄소 승인');
ok((await db.query(`select count(*)::int n from notifications where user_id = $1 and title like '인쇄소 승인%'`, [D])).rows[0].n === 1, '승인되면 인쇄소에 알림');
await fails(ADM, `select admin_set_verified($1, true)`, [A], '소상공인은 승인 대상 아님', 'account_unavailable');
await fails(A, `select admin_set_ai($1, true)`, [B], '일반 회원은 AI 켜기 불가', 'forbidden');
await as(ADM, `select admin_set_ai($1, true)`, [B]);
ok((await as(ADM, `select ai_enabled from admin_accounts() where id = $1`, [B])).rows[0].ai_enabled === true, '관리자가 AI 켜고 목록에서 확인');
await as(ADM, `select admin_set_ai($1, false)`, [B]);
await fails(B, `select consume_ai('brand', 30)`, [], '관리자가 끄면 다시 생성 불가', 'ai_disabled');
const B1 = '22222222-2222-2222-2222-222222222222';
const upsertBrand = name => as(A, `insert into brands (id, owner_id, name, data) values ($1, $2, $3, '{}') on conflict (id) do update set name = excluded.name, data = excluded.data`, [B1, A, name]);
await upsertBrand('한우랑'); await upsertBrand('한우랑2');
ok((await as(A, `select name from brands`)).rows[0].name === '한우랑2', '브랜드 저장, 덮어쓰기');
ok((await as(C, `select * from brands`)).rows.length === 0, '남의 브랜드 조회 불가');
await fails(C, `insert into brands (owner_id, name) values ($1, 'x')`, [A], '남의 계정으로 브랜드 저장 불가');

// 사업자등록번호 (09_bizno.sql)
const E = await signup('printer04', 'printer', { shop_name: '사업자인쇄', biz_no: '1248100998' });
const F = await signup('printer05', 'printer', { shop_name: '번호틀림', biz_no: '12-34' });
ok((await db.query(`select biz_no from print_shops where owner_id = $1`, [E])).rows[0].biz_no === '1248100998', '가입 때 사업자등록번호 저장');
ok((await db.query(`select biz_no from print_shops where owner_id = $1`, [F])).rows[0].biz_no === null, '형식이 틀린 번호는 비워 둠');
ok((await as(ADM, `select biz_no from admin_accounts() where id = $1`, [E])).rows[0].biz_no === '1248100998', '관리자 목록에 사업자등록번호');
await fails(A, `select biz_no from print_shops`, [], '다른 회원은 사업자등록번호 조회 불가');
await fails(E, `update print_shops set biz_status = '01' where owner_id = $1`, [E], '인쇄소가 국세청 상태를 스스로 바꿀 수 없음');
await fails(E, `update print_shops set biz_no = '1111111111' where owner_id = $1`, [E], '가입 뒤 사업자등록번호 직접 변경 불가');

// 웹 푸시 (10_push.sql)
const EP = 'https://fcm.googleapis.com/fcm/send/abc';
await as(A, `select register_push($1, 'p', 'a')`, [EP]);
await as(C, `select register_push($1, 'p2', 'a2')`, [EP]);
ok((await db.query(`select user_id from push_subscriptions where endpoint = $1`, [EP])).rows.map(r => r.user_id).join() === C, '같은 기기를 다른 계정이 등록하면 그 계정으로 옮김');
ok((await as(A, `select * from push_subscriptions`)).rows.length === 0, '남의 푸시 구독 조회 불가');
await fails(A, `insert into push_subscriptions (endpoint, p256dh, auth) values ('https://x', 'p', 'a')`, [], '구독은 함수로만 등록');
await fails(null, `select register_push('https://y', 'p', 'a')`, [], '로그인 안 하면 등록 불가');
const before = (await db.query(`select count(*)::int n from net.sent`)).rows[0].n;
await db.query(`select notify($1, 'message', null, '새 메시지')`, [C]);
const sent = (await db.query(`select url, body from net.sent`)).rows;
ok(sent.length === before + 1 && sent.at(-1).url.endsWith('/functions/v1/send-push') && Number.isInteger(sent.at(-1).body.id), '알림이 생기면 send-push에 id만 보냄');
await as(C, `delete from push_subscriptions where endpoint = $1`, [EP]);
ok((await db.query(`select count(*)::int n from push_subscriptions`)).rows[0].n === 0, '로그아웃 때 내 구독 삭제');

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
