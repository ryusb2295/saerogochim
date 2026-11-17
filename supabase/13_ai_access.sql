-- 12_chat_notify.sql 적용 후 SQL Editor에서 한 번 실행한다. 다시 실행해도 된다.
-- AI 생성은 관리자가 켜 준 계정만 쓴다. 기본값은 꺼짐(OpenAI 요금 보호).
-- 노트북 서버(server.py)와 휴대폰용 함수(functions/ai) 모두 consume_ai를 거치므로 여기서 한 번만 막으면 된다.

-- 일반 회원은 이 칸을 읽거나 바꿀 수 없다 (02_policies.sql의 칸별 권한에 넣지 않음)
alter table public.profiles add column if not exists ai_enabled boolean not null default false;

create or replace function public.consume_ai(p_kind text, p_limit int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or p_kind not in ('image', 'brand') then raise exception 'forbidden'; end if;
  if not coalesce((select ai_enabled from profiles where id = auth.uid()), false) then raise exception 'ai_disabled'; end if;
  insert into ai_usage (user_id, day, kind, used) values (auth.uid(), current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set used = ai_usage.used + 1 where ai_usage.used < p_limit
  returning used into n;
  if n is null then raise exception 'ai_limit'; end if;
  return p_limit - n;               -- 남은 횟수
end $$;

-- 화면이 실제 AI 버튼을 보여 줄지 정할 때 쓴다 (본인 것만)
create or replace function public.my_ai_enabled() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select ai_enabled from profiles where id = auth.uid()), false) $$;
revoke all on function public.my_ai_enabled() from public, anon;
grant execute on function public.my_ai_enabled() to authenticated;

create or replace function public.admin_set_ai(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.profiles set ai_enabled = p_on where id = p_user and role in ('owner', 'printer');
  if not found then raise exception 'account_unavailable'; end if;
end $$;
revoke all on function public.admin_set_ai(uuid, boolean) from public, anon;
grant execute on function public.admin_set_ai(uuid, boolean) to authenticated;

-- 관리자 목록에 AI 사용 여부 칸 추가 (09_bizno.sql 버전에 ai_enabled만 더함)
drop function if exists public.admin_accounts();
create function public.admin_accounts()
returns table (id uuid, username text, role text, display_name text,
               created_at timestamptz, verified boolean,
               biz_no text, biz_status text, biz_checked_at timestamptz, ai_enabled boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, p.username, p.role, p.display_name, p.created_at, s.verified,
           s.biz_no, s.biz_status, s.biz_checked_at, p.ai_enabled
    from public.profiles p
    left join public.print_shops s on s.owner_id = p.id
    where p.role in ('owner', 'printer')
    order by p.created_at desc, p.id;
end $$;
revoke all on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;
