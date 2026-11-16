-- 07_admin.sql 적용 후 SQL Editor에서 한 번 실행한다.
-- 관리자가 인쇄소를 승인하거나 승인을 취소한다.

create or replace function public.admin_set_verified(p_user uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.print_shops set verified = p_verified where owner_id = p_user;
  if not found then raise exception 'account_unavailable'; end if;
  if p_verified then
    perform public.notify(p_user, 'status_changed', null, '인쇄소 승인이 끝났어요. 이제 견적을 보낼 수 있어요.');
  end if;
end $$;
revoke all on function public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- 브랜드 저장은 01_schema.sql에 이미 있는 brands 테이블과 brands_own 정책을 그대로 쓴다.
