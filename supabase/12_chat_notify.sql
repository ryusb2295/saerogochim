-- 10_push.sql 적용 후 SQL Editor에서 한 번 실행한다. 다시 실행해도 된다.
-- 채팅 메시지가 오면 상대방에게 'message' 알림을 만든다.
-- 알림이 생기면 10_push.sql 트리거가 send-push를 불러서, 앱을 닫아 둬도 폰 알림이 간다.

create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations%rowtype; who text;
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id returning * into c;
  -- 인쇄소는 업체명, 소상공인은 가게 이름으로 보여준다
  who := coalesce((select name from print_shops where owner_id = new.sender_id),
                  (select display_name from profiles where id = new.sender_id), '상대방');
  perform notify(case when new.sender_id = c.owner_id then c.printer_id else c.owner_id end,
                 'message', c.request_id, who || ': ' || left(new.body, 60));
  return new;
end $$;
revoke execute on function public.on_message() from public, anon, authenticated;
