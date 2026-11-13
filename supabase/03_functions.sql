-- 가게온: 상태를 바꾸는 함수와 트리거. 설계: docs/PRINT_PLATFORM.md 2.8~2.10
-- 함수는 security definer라 RLS를 건너뛰므로, 각 함수 첫머리에서 호출자 권한을 직접 확인한다.

-- 가입: auth.users가 생기면 metadata의 username/role/display_name으로 profiles를 만든다. 인쇄소면 업체도 같이
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}');
begin
  insert into profiles (id, username, role, display_name)
  values (new.id, lower(m->>'username'), m->>'role', coalesce(nullif(trim(m->>'display_name'), ''), m->>'username'));
  if m->>'role' = 'printer' then
    insert into print_shops (owner_id, name) values (new.id, coalesce(nullif(trim(m->>'shop_name'), ''), m->>'display_name'));
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 아이디 중복 확인 (가입 전이라 로그인 없이 호출). 있는지 없는지만 알려준다
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as
$$ select not exists (select 1 from profiles where username = lower(p_username)) $$;

-- 알림 기록 도우미 (함수 안에서만 씀)
create or replace function public.notify(p_user uuid, p_type text, p_ref uuid, p_title text) returns void
language sql security definer set search_path = public as
$$ insert into notifications (user_id, type, ref_id, title) values (p_user, p_type, p_ref, p_title) $$;

-- 인쇄소용 공개 요청 목록: 소상공인 이름, 원본 경로 없이 견적에 필요한 열만
create or replace function public.list_open_requests(p_item text default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, title text, item text, item_other text, quantity int, width numeric, height numeric, unit text,
               material text, finishing text[], due_date date, quote_deadline timestamptz, region_sido text,
               region_sigungu text, note text, preview_path text, created_at timestamptz, my_quote_status text)
language plpgsql stable security definer set search_path = public as $$
declare shop uuid;
begin
  select s.id into shop from print_shops s where s.owner_id = auth.uid() and s.verified;
  if shop is null then raise exception 'not_verified_printer'; end if;
  return query
    select r.id, r.title, r.item, r.item_other, r.quantity, r.width, r.height, r.unit, r.material, r.finishing,
           r.due_date, r.quote_deadline, r.region_sido, r.region_sigungu, r.note, r.preview_path, r.created_at,
           (select q.status from quotations q where q.request_id = r.id and q.shop_id = shop)
    from print_requests r
    where r.status = 'open' and r.quote_deadline > now() and (p_item is null or r.item = p_item)
    order by r.quote_deadline asc
    limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
end $$;

-- 견적 제출 (같은 요청에 다시 내면 수정). 총액은 단가 × 수량으로 서버가 계산
create or replace function public.submit_quotation(p_request uuid, p_unit_price int, p_quantity int, p_shipping_fee int,
  p_production_days int, p_delivery_date date, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare shop uuid; req print_requests; qid uuid; existed boolean;
begin
  select s.id into shop from print_shops s where s.owner_id = auth.uid() and s.verified;
  if shop is null then raise exception 'not_verified_printer'; end if;
  select * into req from print_requests where id = p_request for update;
  if req.id is null or req.status <> 'open' or req.quote_deadline <= now() then raise exception 'request_closed'; end if;
  if p_delivery_date < current_date then raise exception 'invalid_delivery_date'; end if;
  select true into existed from quotations where request_id = p_request and shop_id = shop;
  insert into quotations (request_id, shop_id, unit_price, quantity, total_price, shipping_fee, production_days, delivery_date, note)
  values (p_request, shop, p_unit_price, p_quantity, p_unit_price * p_quantity, p_shipping_fee, p_production_days, p_delivery_date, p_note)
  on conflict (request_id, shop_id) do update set
    unit_price = excluded.unit_price, quantity = excluded.quantity, total_price = excluded.total_price,
    shipping_fee = excluded.shipping_fee, production_days = excluded.production_days,
    delivery_date = excluded.delivery_date, note = excluded.note, status = 'submitted', updated_at = now()
  where quotations.status in ('submitted', 'withdrawn')
  returning id into qid;
  if qid is null then raise exception 'quote_locked'; end if;
  if existed is null then
    perform notify(req.owner_id, 'quote_received', p_request, '"' || req.title || '"에 새 견적이 도착했어요');
  end if;
  return qid;
end $$;

create or replace function public.withdraw_quotation(p_quote uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update quotations set status = 'withdrawn', updated_at = now()
  where id = p_quote and shop_id = public.my_shop_id() and status = 'submitted';
  if not found then raise exception 'quote_unavailable'; end if;
end $$;

-- 견적 수락: 요청 잠금 → 수락 → 나머지 거절 → 요청 상태 → 채팅방 → 알림을 한 트랜잭션으로
create or replace function public.accept_quotation(p_quote uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare q quotations; req print_requests; printer uuid; conv uuid;
begin
  select * into q from quotations where id = p_quote;
  if q.id is null then raise exception 'quote_unavailable'; end if;
  select * into req from print_requests where id = q.request_id for update;
  if req.owner_id <> auth.uid() then raise exception 'forbidden'; end if;
  if req.status <> 'open' then raise exception 'already_closed'; end if;
  if q.status <> 'submitted' then raise exception 'quote_unavailable'; end if;

  update quotations set status = 'accepted', updated_at = now() where id = q.id;
  update quotations set status = 'declined', updated_at = now()
    where request_id = req.id and id <> q.id and status = 'submitted';
  update print_requests set status = 'accepted', accepted_quotation_id = q.id, updated_at = now() where id = req.id;

  select owner_id into printer from print_shops where id = q.shop_id;
  insert into conversations (request_id, owner_id, printer_id) values (req.id, req.owner_id, printer)
    on conflict (request_id) do nothing;
  select id into conv from conversations where request_id = req.id;

  perform notify(printer, 'quote_accepted', req.id, '"' || req.title || '" 견적이 수락됐어요. 채팅을 시작해 보세요');
  perform notify(s.owner_id, 'quote_declined', req.id, '"' || req.title || '" 의뢰가 다른 업체로 정해졌어요')
    from quotations x join print_shops s on s.id = x.shop_id
    where x.request_id = req.id and x.status = 'declined';
  return conv;
end $$;

-- 요청 취소 (견적 받는 중일 때만)
create or replace function public.cancel_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare req print_requests;
begin
  select * into req from print_requests where id = p_request for update;
  if req.owner_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if req.status <> 'open' then raise exception 'already_closed'; end if;
  update print_requests set status = 'canceled', updated_at = now() where id = req.id;
  update quotations set status = 'declined', updated_at = now() where request_id = req.id and status = 'submitted';
end $$;

-- 의뢰 진행: 인쇄소는 accepted → in_progress → delivered, 소상공인은 delivered → completed
create or replace function public.advance_request(p_request uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare req print_requests; printer uuid;
begin
  select * into req from print_requests where id = p_request for update;
  if req.id is null then raise exception 'forbidden'; end if;
  select s.owner_id into printer from quotations q join print_shops s on s.id = q.shop_id where q.id = req.accepted_quotation_id;
  if (auth.uid() = printer and (req.status, p_status) in (('accepted', 'in_progress'), ('in_progress', 'delivered')))
     or (auth.uid() = req.owner_id and req.status = 'delivered' and p_status = 'completed') then
    update print_requests set status = p_status, updated_at = now() where id = req.id;
    perform notify(case when auth.uid() = printer then req.owner_id else printer end, 'status_changed', req.id,
      '"' || req.title || '" 상태: ' || case p_status when 'in_progress' then '제작 중' when 'delivered' then '납품 완료' else '완료' end);
  else
    raise exception 'invalid_transition';
  end if;
end $$;

-- 수락된 의뢰 상대에게만 업체 상세 주소 공개
create or replace function public.shop_address(p_request uuid) returns text
language sql stable security definer set search_path = public as $$
  select s.address_detail from print_requests r join quotations q on q.id = r.accepted_quotation_id
  join print_shops s on s.id = q.shop_id
  where r.id = p_request and auth.uid() in (r.owner_id, s.owner_id)
$$;

-- 채팅 목록: 상대 이름, 요청 제목, 마지막 메시지, 안 읽은 수 (RLS가 그대로 적용되도록 invoker)
create or replace function public.my_conversations()
returns table (id uuid, request_id uuid, title text, request_status text, other_name text,
               last_body text, last_at timestamptz, unread bigint)
language sql stable security invoker set search_path = public as $$
  select c.id, c.request_id, r.title, r.status, p.display_name,
         (select m.body from messages m where m.conversation_id = c.id order by m.id desc limit 1),
         coalesce(c.last_message_at, c.created_at),
         (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid()
            and m.id > coalesce((select cr.last_read_id from conversation_reads cr
                                 where cr.conversation_id = c.id and cr.user_id = auth.uid()), 0))
  from conversations c
  join print_requests r on r.id = c.request_id
  join profiles p on p.id = case when c.owner_id = auth.uid() then c.printer_id else c.owner_id end
  order by coalesce(c.last_message_at, c.created_at) desc
$$;

create or replace function public.mark_read(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from conversations where id = p_conv and auth.uid() in (owner_id, printer_id)) then
    raise exception 'forbidden';
  end if;
  insert into conversation_reads (conversation_id, user_id, last_read_id)
  values (p_conv, auth.uid(), coalesce((select max(id) from messages where conversation_id = p_conv), 0))
  on conflict (conversation_id, user_id) do update set last_read_id = excluded.last_read_id;
end $$;

-- 새 메시지: 채팅방 최근 시간 갱신
create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists on_message_insert on public.messages;
create trigger on_message_insert after insert on public.messages for each row execute function public.on_message();

-- AI 생성 횟수 차감. Python 서버가 사용자 토큰으로 호출하므로 auth.uid()가 그 사용자다
create or replace function public.consume_ai(p_kind text, p_limit int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or p_kind not in ('image', 'brand') then raise exception 'forbidden'; end if;
  insert into ai_usage (user_id, day, kind, used) values (auth.uid(), current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set used = ai_usage.used + 1 where ai_usage.used < p_limit
  returning used into n;
  if n is null then raise exception 'ai_limit'; end if;
  return p_limit - n;               -- 남은 횟수
end $$;

-- 함수 실행 권한: 기본은 막고 필요한 것만 연다
revoke execute on all functions in schema public from public, anon;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.my_role(), public.my_shop_id(), public.request_owner(uuid), public.accepted_shop(uuid),
  public.list_open_requests(text, int, int), public.submit_quotation(uuid, int, int, int, int, date, text),
  public.withdraw_quotation(uuid), public.accept_quotation(uuid), public.cancel_request(uuid),
  public.advance_request(uuid, text), public.shop_address(uuid), public.my_conversations(), public.mark_read(uuid),
  public.consume_ai(text, int)
  to authenticated;
revoke execute on function public.notify(uuid, text, uuid, text), public.handle_new_user(), public.on_message() from authenticated;
