// 관리자 화면의 '국세청 확인' 버튼이 부른다. 인쇄소의 사업자등록번호로 국세청 상태를 조회해 print_shops에 기록한다.
// 국세청 키(NTS_SERVICE_KEY)는 Supabase Edge Function Secrets에만 두고, 브라우저와 저장소에는 넣지 않는다.
// API: 공공데이터포털 "국세청_사업자등록정보 진위확인 및 상태조회 서비스" (status)
import { createClient } from 'npm:@supabase/supabase-js@2.110.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // 공공데이터포털의 Encoding 키(%2B 등 포함)와 Decoding 키 둘 다 받도록 한 번 풀어 둔다
    const raw = Deno.env.get('NTS_SERVICE_KEY')?.trim();
    const key = raw?.includes('%') ? decodeURIComponent(raw) : raw;
    if (!key) return json({ error: 'nts_key_missing' }, 500);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 부른 사람이 관리자인지 직접 확인한다 (클라이언트가 보낸 값은 믿지 않음)
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth?.user) return json({ error: 'forbidden' }, 401);
    const { data: me } = await admin.from('profiles').select('role').eq('id', auth.user.id).single();
    if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403);

    const { user_id } = await req.json();
    const { data: shop } = await admin.from('print_shops').select('id,biz_no').eq('owner_id', user_id).maybeSingle();
    if (!shop) return json({ error: 'account_unavailable' }, 404);
    if (!shop.biz_no) return json({ error: 'biz_no_missing' }, 400);

    const r = await fetch('https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ b_no: [shop.biz_no] }),
    });
    if (!r.ok) return json({ error: 'nts_failed', status: r.status }, 502);
    const d = (await r.json()).data?.[0];
    // 등록되지 않은 번호는 b_stt_cd가 빈 문자열로 온다
    const status = d?.b_stt_cd || 'none';
    await admin.from('print_shops').update({ biz_status: status, biz_checked_at: new Date().toISOString() }).eq('id', shop.id);
    return json({ biz_status: status });
  } catch {
    return json({ error: 'nts_failed' }, 500);
  }
});
