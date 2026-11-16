-- 08_launch.sql 적용 후 SQL Editor에서 한 번 실행한다.
-- 인쇄소 사업자등록번호를 가입 때 받고, 관리자 화면에서 국세청 상태(계속/휴업/폐업)를 확인한다.
-- 번호와 상태 칸은 02_policies.sql의 컬럼 권한에 없어서 다른 회원은 읽거나 바꿀 수 없다.
-- 상태는 Edge Function(supabase/functions/verify-biz)이 서버 권한으로만 기록한다.

alter table public.print_shops
  add column if not exists biz_no text check (biz_no ~ '^[0-9]{10}$'),
  add column if not exists biz_status text,          -- 국세청 b_stt_cd: 01 계속, 02 휴업, 03 폐업, none 미등록
  add column if not exists biz_checked_at timestamptz;

-- 07_admin.sql의 가입 함수에 사업자등록번호 저장만 더했다. 형식이 틀리면 비워 두고 관리자 화면에 '번호 없음'으로 보인다
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}');
begin
  if lower(m->>'username') = 'admin' or m->>'role' not in ('owner', 'printer') then
    raise exception 'invalid_signup_role';
  end if;
  insert into public.profiles (id, username, role, display_name)
  values (new.id, lower(m->>'username'), m->>'role',
          coalesce(nullif(trim(m->>'display_name'), ''), m->>'username'));
  if m->>'role' = 'printer' then
    insert into public.print_shops (owner_id, name, biz_no)
    values (new.id, coalesce(nullif(trim(m->>'shop_name'), ''), m->>'display_name'),
            case when m->>'biz_no' ~ '^[0-9]{10}$' then m->>'biz_no' end);
  end if;
  return new;
end $$;

drop function if exists public.admin_accounts();
create function public.admin_accounts()
returns table (id uuid, username text, role text, display_name text,
               created_at timestamptz, verified boolean,
               biz_no text, biz_status text, biz_checked_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, p.username, p.role, p.display_name, p.created_at, s.verified,
           s.biz_no, s.biz_status, s.biz_checked_at
    from public.profiles p
    left join public.print_shops s on s.owner_id = p.id
    where p.role in ('owner', 'printer')
    order by p.created_at desc, p.id;
end $$;
revoke all on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;
