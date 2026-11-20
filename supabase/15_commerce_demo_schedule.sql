-- Optional unattended monthly simulation. Requires 14_commerce_demo.sql.
-- Existing rows hold their plan token cap and source-order fee snapshot.
create unique index if not exists commerce_demo_order_cycle
on public.commerce_demo_orders(owner_id, (data->>'recurringDeliveryId'), (data->>'cycleKey'))
where data->>'recurringDeliveryId' is not null;

create or replace function public.commerce_demo_tick() returns integer
language plpgsql security definer set search_path = public as $$
declare row_account commerce_demo_accounts; a jsonb; r jsonb; source commerce_demo_orders;
  recurring_items jsonb; run_at timestamptz; renew_at timestamptz; next_at timestamptz;
  order_id text; cycle_key text; total integer := 0; cap integer; balance integer; inserted integer;
begin
  for row_account in select * from commerce_demo_accounts loop
    perform pg_advisory_xact_lock(hashtextextended('commerce-demo:' || row_account.user_id::text, 0));
    select * into row_account from commerce_demo_accounts where user_id = row_account.user_id for update;
    a := row_account.data;
    renew_at := nullif(a->>'planRenewsAt','')::timestamptz;
    if a->>'plan' <> 'free' and renew_at <= now() then
      balance := (a->>'tokenBalance')::integer;
      if coalesce((a->>'cancelAtRenewal')::boolean,false) then
        a := a || jsonb_build_object('plan','free','planRenewsAt',null,'cancelAtRenewal',false,'tokenBalance',0);
        cap := 0;
      else
        cap := (a->>'planTokenLimit')::integer;
        if cap is null then continue; end if;
        while renew_at <= now() loop renew_at := renew_at + interval '1 month'; end loop;
        a := a || jsonb_build_object('tokenBalance',cap,'planRenewsAt',renew_at);
      end if;
      a := jsonb_set(a,'{ledger}', jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'userId',row_account.user_id,'delta',cap-balance,'reason','subscription','note','월 한도 갱신 · 이월 없음','createdAt',now())) || coalesce(a->'ledger','[]'::jsonb));
    end if;
    recurring_items := '[]'::jsonb;
    for r in select value from jsonb_array_elements(coalesce(a->'recurring','[]'::jsonb)) loop
      if a->>'plan' = 'pro' and coalesce((r->>'active')::boolean,false) then
        run_at := (r->>'nextRunAt')::timestamptz;
        if run_at <= now() then
          select * into source from commerce_demo_orders where id = r->>'sourceOrderId' and owner_id = row_account.user_id;
          if source.id is not null and source.data->>'status' in ('delivered','completed') then
            order_id := gen_random_uuid()::text; cycle_key := to_char(run_at at time zone 'UTC','YYYY-MM');
            insert into commerce_demo_orders(id,owner_id,printer_key,data)
            values(order_id,row_account.user_id,source.printer_key,
              (source.data - '_revision') || jsonb_build_object('id',order_id,'status','awaiting_payment','paidAt',null,'confirmedAt',null,
                'createdAt',now(),'due',to_char(current_date+14,'YYYY-MM-DD'),'reorderOf',source.id,'recurringDeliveryId',r->>'id','cycleKey',cycle_key))
            on conflict do nothing;
            get diagnostics inserted = row_count;
            total := total + inserted;
          end if;
          next_at := (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC') + interval '1 month';
          r := r || jsonb_build_object('nextRunAt',next_at);
        end if;
      end if;
      recurring_items := recurring_items || jsonb_build_array(r);
    end loop;
    a := jsonb_set(a,'{recurring}',recurring_items);
    if a <> row_account.data then update commerce_demo_accounts set data=a,revision=revision+1 where user_id=row_account.user_id; end if;
  end loop;
  return total;
end $$;
revoke all on function public.commerce_demo_tick() from public;
grant execute on function public.commerce_demo_tick() to service_role;

-- Enable pg_cron in the dashboard first. This block registers only when available.
-- UTC 00:00 on the 1st is 09:00 in Korea. No real payment or print request is sent.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    execute 'select cron.unschedule(jobid) from cron.job where jobname = ''gageon-commerce-demo-monthly''';
    execute 'select cron.schedule(''gageon-commerce-demo-monthly'',''0 0 1 * *'',''select public.commerce_demo_tick();'')';
  end if;
end $$;
