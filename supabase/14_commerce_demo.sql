-- Optional cross-device state for the hackathon simulator. No real payment data.
-- Apply once in Supabase SQL Editor after the existing schema.
create table if not exists public.commerce_demo_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1
);
create table if not exists public.commerce_demo_orders (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  printer_key text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1
);
alter table public.commerce_demo_accounts enable row level security;
alter table public.commerce_demo_orders enable row level security;
revoke all on public.commerce_demo_accounts, public.commerce_demo_orders from anon, authenticated;

create or replace function public.commerce_demo_can_print(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    (p_key = 'demoprint' and auth.jwt()->>'email' = 'demoprint@users.gageon.invalid')
    or exists (select 1 from print_shops s where s.id::text = p_key and s.owner_id = auth.uid())
  );
$$;

create or replace function public.commerce_demo_read() returns jsonb
language plpgsql security definer set search_path = public as $$
declare a commerce_demo_accounts; result_orders jsonb;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  select * into a from commerce_demo_accounts where user_id = auth.uid();
  select coalesce(jsonb_agg(o.data || jsonb_build_object('_revision', o.revision)), '[]'::jsonb)
    into result_orders from commerce_demo_orders o
    where o.owner_id = auth.uid() or commerce_demo_can_print(o.printer_key);
  return jsonb_build_object('revision', coalesce(a.revision, 0), 'account', a.data, 'orders', result_orders);
end $$;

create or replace function public.commerce_demo_save(p_revision bigint, p_account jsonb, p_orders jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare current_revision bigint; item jsonb; old_order commerce_demo_orders; new_data jsonb;
begin
  if auth.uid() is null or (p_account->>'userId') is distinct from auth.uid()::text then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_orders) is distinct from 'array' or coalesce(p_account->>'plan','') not in ('free','lite','pro') or jsonb_typeof(p_account->'tokenBalance') is distinct from 'number'
    or (p_account->>'tokenBalance')::numeric < 0 or (p_account->>'tokenBalance')::numeric > 1000000
    then raise exception 'invalid_demo_state'; end if;
  -- Account advisory lock also serializes first-write (no row yet) requests.
  perform pg_advisory_xact_lock(hashtextextended('commerce-demo:' || auth.uid()::text, 0));
  select revision into current_revision from commerce_demo_accounts where user_id = auth.uid() for update;
  if coalesce(current_revision, 0) <> p_revision then raise exception 'demo_revision_conflict'; end if;
  insert into commerce_demo_accounts(user_id, data, revision) values (auth.uid(), p_account, 1)
    on conflict (user_id) do update set data = excluded.data, revision = commerce_demo_accounts.revision + 1;
  for item in select value from jsonb_array_elements(p_orders) loop
    if (item->>'simulated') is distinct from 'true' or coalesce(item->>'id','') = '' then raise exception 'invalid_demo_order'; end if;
    new_data = item - '_revision';
    select * into old_order from commerce_demo_orders where id = item->>'id' for update;
    if old_order.id is not null and coalesce((item->>'_revision')::bigint,0) <> old_order.revision then raise exception 'demo_revision_conflict'; end if;
    if old_order.id is null then
      if (item->>'userId') is distinct from auth.uid()::text then raise exception 'forbidden'; end if;
      insert into commerce_demo_orders(id, owner_id, printer_key, data)
        values (item->>'id', auth.uid(), item->>'printerId', new_data);
    elsif old_order.owner_id = auth.uid() then
      if (item->>'userId') is distinct from auth.uid()::text then raise exception 'forbidden'; end if;
      update commerce_demo_orders set data = new_data, printer_key = item->>'printerId', revision = revision + 1 where id = old_order.id;
    else
      -- A printer may advance its paid order, never change its price or owner.
      if not commerce_demo_can_print(old_order.printer_key) or old_order.data->>'paidAt' is null
        or new_data - 'status' <> old_order.data - 'status'
        or not ((old_order.data->>'status' = 'accepted' and item->>'status' = 'in_progress')
          or (old_order.data->>'status' = 'in_progress' and item->>'status' = 'delivered')
          or item->>'status' = old_order.data->>'status') then raise exception 'forbidden'; end if;
      update commerce_demo_orders set data = new_data, revision = revision + 1 where id = old_order.id;
    end if;
  end loop;
  delete from commerce_demo_orders o where o.owner_id = auth.uid()
    and not exists(select 1 from jsonb_array_elements(p_orders) x where x->>'id' = o.id);
  return commerce_demo_read();
end $$;
revoke all on function public.commerce_demo_can_print(text), public.commerce_demo_read(), public.commerce_demo_save(bigint,jsonb,jsonb) from public;
grant execute on function public.commerce_demo_read(), public.commerce_demo_save(bigint,jsonb,jsonb) to authenticated;
