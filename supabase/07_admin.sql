-- 01~06 적용 후 SQL Editor에서 한 번 실행한다.
-- 관리자 권한은 클라이언트 metadata가 아니라 profiles.role로만 판단한다.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'printer', 'admin'));
create unique index if not exists one_admin_profile on public.profiles (role)
  where role = 'admin';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}');
begin
  -- 공개 회원가입에서 관리자 역할과 admin 아이디를 만들 수 없다.
  if lower(m->>'username') = 'admin' or m->>'role' not in ('owner', 'printer') then
    raise exception 'invalid_signup_role';
  end if;
  insert into public.profiles (id, username, role, display_name)
  values (new.id, lower(m->>'username'), m->>'role',
          coalesce(nullif(trim(m->>'display_name'), ''), m->>'username'));
  if m->>'role' = 'printer' then
    insert into public.print_shops (owner_id, name)
    values (new.id, coalesce(nullif(trim(m->>'shop_name'), ''), m->>'display_name'));
  end if;
  return new;
end $$;

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(p_username) <> 'admin'
     and not exists (select 1 from public.profiles where username = lower(p_username))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin')
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_accounts()
returns table (id uuid, username text, role text, display_name text,
               created_at timestamptz, verified boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, p.username, p.role, p.display_name, p.created_at, s.verified
    from public.profiles p
    left join public.print_shops s on s.owner_id = p.id
    where p.role in ('owner', 'printer')
    order by p.created_at desc, p.id;
end $$;
revoke all on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;

-- 삭제 전에 파일 목록을 받아 Storage API로 지울 수 있게 한다.
create or replace function public.admin_account_files(p_user uuid)
returns table (bucket_id text, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.profiles
                 where id = p_user and role in ('owner', 'printer')) then
    raise exception 'account_unavailable';
  end if;
  return query
    select o.bucket_id, o.name from storage.objects o
    where o.bucket_id in ('brand-assets', 'request-files', 'request-previews')
      and o.name like p_user::text || '/%';
end $$;
revoke all on function public.admin_account_files(uuid) from public, anon;
grant execute on function public.admin_account_files(uuid) to authenticated;

create policy admin_delete_files on storage.objects for delete to authenticated
  using (bucket_id in ('brand-assets', 'request-files', 'request-previews')
         and public.is_admin());
create policy admin_read_files on storage.objects for select to authenticated
  using (bucket_id in ('brand-assets', 'request-files', 'request-previews')
         and public.is_admin());

create or replace function public.admin_delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target_role text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select role into target_role from public.profiles where id = p_user for update;
  if target_role not in ('owner', 'printer') or target_role is null then
    raise exception 'account_unavailable';
  end if;

  -- 선택된 인쇄소가 탈퇴하면 해당 의뢰를 다시 견적 대기 또는 마감 상태로 돌린다.
  update public.print_requests r
     set accepted_quotation_id = null,
         status = case when r.status = 'completed' then 'completed'
                       when r.quote_deadline > now() then 'open' else 'expired' end,
         updated_at = now()
   where r.owner_id <> p_user
     and r.accepted_quotation_id in (
       select q.id from public.quotations q
       join public.print_shops s on s.id = q.shop_id
       where s.owner_id = p_user
     );

  -- 요청과 견적이 순환 참조하므로 삭제 전 참조를 풀어 둔다.
  update public.print_requests
     set accepted_quotation_id = null
   where owner_id = p_user;

  if exists (select 1 from storage.objects o
             where o.bucket_id in ('brand-assets', 'request-files', 'request-previews')
               and o.name like p_user::text || '/%') then
    raise exception 'files_remaining';
  end if;

  delete from auth.users where id = p_user;
  if not found then raise exception 'account_unavailable'; end if;
end $$;
revoke all on function public.admin_delete_account(uuid) from public, anon;
grant execute on function public.admin_delete_account(uuid) to authenticated;
