-- 가게온: 접근 권한 (RLS). 설계: docs/PRINT_PLATFORM.md 2.7
-- 원칙: 여기 적힌 것 외에는 전부 거부. 상태를 바꾸는 쓰기는 03_functions.sql의 함수로만.

alter table public.profiles enable row level security;
alter table public.print_shops enable row level security;
alter table public.brands enable row level security;
alter table public.print_requests enable row level security;
alter table public.quotations enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_usage enable row level security;

-- 로그인 안 한 사용자는 테이블에 직접 접근하지 못함 (아이디 중복 확인은 함수로)
revoke all on all tables in schema public from anon;

-- 내 역할 / 내 인쇄소. 정책 안에서 쓰는 도우미 (RLS 재귀를 피하려고 security definer)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function public.my_shop_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from print_shops where owner_id = auth.uid() $$;

-- 요청 ↔ 견적 정책이 서로를 조회하면 RLS가 무한 재귀에 빠져서, 조회는 이 두 함수로 한다
create or replace function public.request_owner(req uuid) returns uuid
language sql stable security definer set search_path = public as
$$ select owner_id from print_requests where id = req $$;

create or replace function public.accepted_shop(req uuid) returns uuid
language sql stable security definer set search_path = public as
$$ select q.shop_id from print_requests r join quotations q on q.id = r.accepted_quotation_id where r.id = req $$;

-- profiles: 표시 이름과 역할만 서로 볼 수 있음. 아이디(username)는 본인도 테이블로는 안 읽고 세션 metadata로 읽음
revoke all on public.profiles from authenticated;
grant select (id, role, display_name, created_at) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- print_shops: 업체 카드(주소 상세 제외)는 로그인 사용자 모두. 수정은 본인만, verified는 못 바꿈
revoke all on public.print_shops from authenticated;
grant select (id, owner_id, name, region_sido, region_sigungu, items, intro, min_quantity, verified, created_at)
  on public.print_shops to authenticated;
grant update (name, region_sido, region_sigungu, address_detail, items, intro, min_quantity)
  on public.print_shops to authenticated;
create policy shops_read on public.print_shops for select to authenticated using (true);
create policy shops_update_self on public.print_shops for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- brands: 본인 것만
create policy brands_own on public.brands for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.my_role() = 'owner');

-- print_requests: 요청 주인 + 견적이 수락된 인쇄소만 직접 조회.
-- 공개 요청 목록은 함수 list_open_requests (소상공인 정보 없이 필요한 열만)
revoke update, delete on public.print_requests from authenticated;
create policy requests_read on public.print_requests for select to authenticated using (
  owner_id = auth.uid() or public.accepted_shop(id) = public.my_shop_id()
);
create policy requests_insert on public.print_requests for insert to authenticated with check (
  owner_id = auth.uid() and public.my_role() = 'owner'
  and status = 'open' and accepted_quotation_id is null
  and quote_deadline > now()
  and design_path like auth.uid()::text || '/%' and preview_path like auth.uid()::text || '/%'
);

-- quotations: 요청 주인은 자기 요청의 모든 견적, 인쇄소는 자기 견적만. 다른 업체 금액은 볼 수 없음.
-- 쓰기는 submit_quotation / withdraw_quotation / accept_quotation 함수만
revoke insert, update, delete on public.quotations from authenticated;
create policy quotes_read on public.quotations for select to authenticated using (
  shop_id = public.my_shop_id() or public.request_owner(request_id) = auth.uid()
);

-- conversations: 참여자만 조회. 생성은 accept_quotation만
revoke insert, update, delete on public.conversations from authenticated;
create policy convs_read on public.conversations for select to authenticated
  using (auth.uid() in (owner_id, printer_id));

-- messages: 참여자만 조회, 참여자 본인 이름으로만 전송. 수정, 삭제 없음
revoke update, delete on public.messages from authenticated;
create policy msgs_read on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c
          where c.id = messages.conversation_id and auth.uid() in (c.owner_id, c.printer_id))
);
create policy msgs_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c
              where c.id = messages.conversation_id and auth.uid() in (c.owner_id, c.printer_id))
);

-- conversation_reads: 본인 행만 (함수 mark_read가 주로 씀)
create policy reads_own on public.conversation_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notifications: 본인 것 조회, 읽음 표시만 수정
revoke all on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notis_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notis_mark on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ai_usage: 본인 조회만. 차감은 함수 consume_ai
revoke insert, update, delete on public.ai_usage from authenticated;
create policy usage_read on public.ai_usage for select to authenticated using (user_id = auth.uid());
