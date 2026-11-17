-- 09_bizno.sql 적용 후 SQL Editor에서 한 번 실행한다.
-- 웹 푸시: 앱을 닫아 둬도 새 알림(견적, 채팅, 상태 변경)을 폰 알림으로 보낸다.
-- 알림 행이 생기면 pg_net이 Edge Function(send-push)에 알림 id만 보낸다.
-- 함수는 그 id의 알림을 서버 권한으로 다시 읽고 pushed_at을 채운 뒤 한 번만 보내므로, 누가 함수를 직접 불러도 없는 알림을 만들거나 두 번 보낼 수 없다.

create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- 같은 기기(endpoint)에서 다른 계정으로 바꿔 등록하면 기존 계정의 구독을 지우고 지금 계정으로 옮긴다
create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end $$;
revoke all on function public.register_push(text, text, text) from public, anon;
grant execute on function public.register_push(text, text, text) to authenticated;

alter table public.notifications add column if not exists pushed_at timestamptz;

create or replace function public.push_on_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://fthcyxhmgqqxtltyombf.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end $$;

drop trigger if exists push_after_notification on public.notifications;
create trigger push_after_notification after insert on public.notifications
  for each row execute function public.push_on_notification();
