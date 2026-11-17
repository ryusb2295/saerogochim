// notifications에 행이 생기면 DB 트리거(10_push.sql)가 { id }만 보내 부른다.
// 알림을 서버 권한으로 다시 읽고 pushed_at을 채운 다음, 받는 사람이 등록한 기기들에 웹 푸시를 보낸다.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (.env.push에 있음, 저장소에는 없음)
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.110.0';

const APP_URL = 'https://saerogochim.vercel.app/';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  try {
    const pub = Deno.env.get('VAPID_PUBLIC_KEY'), priv = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!pub || !priv) return json({ error: 'vapid_missing' }, 500);
    webpush.setVapidDetails(APP_URL, pub, priv);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { id } = await req.json();
    if (!Number.isInteger(id)) return json({ error: 'bad_id' }, 400);
    // 방금 생긴, 아직 안 보낸 알림만 한 번 가져간다
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: n } = await db.from('notifications').update({ pushed_at: new Date().toISOString() })
      .eq('id', id).is('pushed_at', null).gt('created_at', since)
      .select('user_id,type,title').maybeSingle();
    if (!n) return json({ sent: 0 });

    const { data: subs } = await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', n.user_id);
    const payload = JSON.stringify({ title: '가게온', body: n.title, tag: n.type === 'message' ? 'chat' : 'noti-' + id, page: n.type === 'message' ? 'chats' : 'notis' });
    let sent = 0;
    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        // 404/410: 브라우저가 구독을 버렸다. 다음에 안 보내게 지운다
        if ([404, 410].includes((e as { statusCode?: number }).statusCode ?? 0)) await db.from('push_subscriptions').delete().eq('id', s.id);
      }
    }
    return json({ sent });
  } catch (e) {
    console.error('send-push failed:', e);   // Edge Functions > send-push > Logs 에서 원인 확인
    return json({ error: 'push_failed' }, 500);
  }
});
