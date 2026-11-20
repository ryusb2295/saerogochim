-- 시연용: 관리자가 사장님 계정에 온을 무료로 충전한다. 실제 결제 없음.
-- 14_commerce_demo.sql 다음에 Supabase SQL Editor에서 한 번 실행.
create or replace function public.admin_grant_tokens(p_user uuid, p_amount int)
returns numeric
language plpgsql security definer set search_path = public as $$
declare new_balance numeric;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then raise exception 'invalid_amount'; end if;
  perform pg_advisory_xact_lock(hashtextextended('commerce-demo:' || p_user::text, 0));
  update public.commerce_demo_accounts
     set data = jsonb_set(jsonb_set(data, '{tokenBalance}',
                  to_jsonb(least(1000000, coalesce((data->>'tokenBalance')::numeric, 0) + p_amount))),
                '{ledger}', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'userId', p_user::text,
                  'delta', p_amount, 'reason', 'purchase', 'note', '관리자 무료 충전', 'createdAt', to_jsonb(now())))
                  || coalesce(data->'ledger', '[]'::jsonb)),
         revision = revision + 1
   where user_id = p_user
  returning (data->>'tokenBalance')::numeric into new_balance;
  if new_balance is null then raise exception 'no_demo_account'; end if;
  return new_balance;
end $$;
revoke all on function public.admin_grant_tokens(uuid, int) from public, anon;
grant execute on function public.admin_grant_tokens(uuid, int) to authenticated;
