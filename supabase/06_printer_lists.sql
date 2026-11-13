-- 인쇄소 '보낸 견적' 목록: 인쇄소는 수락 전 요청 테이블을 직접 못 보므로, 자기 견적에 붙은 요청 요약만 함수로 준다
create or replace function public.my_quotes()
returns table (id uuid, request_id uuid, title text, item text, request_status text, quantity int,
               total_price int, shipping_fee int, production_days int, delivery_date date, status text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, q.request_id, r.title, r.item, r.status, q.quantity, q.total_price, q.shipping_fee,
         q.production_days, q.delivery_date, q.status, q.updated_at
  from quotations q join print_requests r on r.id = q.request_id
  where q.shop_id = public.my_shop_id()
  order by q.updated_at desc
$$;
revoke execute on function public.my_quotes() from public, anon;
grant execute on function public.my_quotes() to authenticated;
