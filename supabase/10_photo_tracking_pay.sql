-- 가게온: 채팅 사진, 송장번호, 단계별 날짜, 결제 표시
-- Supabase SQL Editor에서 한 번 실행한다. 다시 실행해도 된다.

-- 1) 의뢰에 단계별 시각, 송장, 결제 칸 추가
alter table public.print_requests
  add column if not exists accepted_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists courier text check (char_length(courier) <= 20),
  add column if not exists tracking_no text check (char_length(tracking_no) <= 30),
  add column if not exists paid_at timestamptz,
  add column if not exists pay_key text check (char_length(pay_key) <= 200);

-- 상태가 바뀔 때 그 단계의 시각을 적는다. accept_quotation, advance_request를 고치지 않아도 된다.
-- 새 요청을 넣을 때 결제 칸을 미리 채워 보내는 것도 여기서 막는다
create or replace function public.stamp_request() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.paid_at := null; new.pay_key := null; new.courier := null; new.tracking_no := null;
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then new.accepted_at := now();
    elsif new.status = 'in_progress' then new.started_at := now();
    elsif new.status = 'delivered' then new.delivered_at := now();
    elsif new.status = 'completed' then new.completed_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists stamp_request on public.print_requests;
create trigger stamp_request before insert or update on public.print_requests
  for each row execute function public.stamp_request();

-- 2) 송장번호: 수락된 인쇄소만, 제작 중이거나 납품한 의뢰에만 적는다
create or replace function public.set_tracking(p_request uuid, p_courier text, p_no text) returns void
language plpgsql security definer set search_path = public as $$
declare req print_requests;
begin
  select * into req from print_requests where id = p_request for update;
  if req.id is null or public.accepted_shop(req.id) is distinct from public.my_shop_id()
     or req.status not in ('in_progress', 'delivered') then
    raise exception 'forbidden';
  end if;
  update print_requests set courier = nullif(trim(p_courier), ''), tracking_no = nullif(trim(p_no), ''), updated_at = now()
  where id = req.id;
end $$;
grant execute on function public.set_tracking(uuid, text, text) to authenticated;

-- 3) 결제 표시: 요청 주인이 수락한 의뢰에 한 번만
-- shortcut: 토스 승인 API를 부르지 않고 브라우저가 알려준 결제 키만 적는다. 금액 검증이 없어 시연용이다.
--           실제 돈을 받으려면 Edge Function에서 시크릿 키로 승인한 뒤 이 칸을 채우도록 바꾼다
create or replace function public.mark_paid(p_request uuid, p_pay_key text) returns void
language plpgsql security definer set search_path = public as $$
declare req print_requests; printer uuid;
begin
  select * into req from print_requests where id = p_request for update;
  if req.id is null or req.owner_id <> auth.uid() or req.accepted_quotation_id is null then raise exception 'forbidden'; end if;
  if req.paid_at is not null then return; end if;
  update print_requests set paid_at = now(), pay_key = left(p_pay_key, 200), updated_at = now() where id = req.id;
  select s.owner_id into printer from quotations q join print_shops s on s.id = q.shop_id where q.id = req.accepted_quotation_id;
  perform notify(printer, 'status_changed', req.id, '"' || req.title || '" 결제가 완료됐어요');
end $$;
grant execute on function public.mark_paid(uuid, text) to authenticated;

-- 4) 채팅 사진: 메시지에 사진 경로 칸, 비공개 버킷 (5MB, 이미지만)
alter table public.messages add column if not exists image_path text check (char_length(image_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('chat-images', 'chat-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 경로: {보낸 사람 id}/{채팅방 id}/{파일}. 채팅방 참여자만 올리고 볼 수 있다
drop policy if exists chat_img_upload on storage.objects;
create policy chat_img_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.conversations c
              where c.id::text = (storage.foldername(name))[2] and auth.uid() in (c.owner_id, c.printer_id))
);
drop policy if exists chat_img_read on storage.objects;
create policy chat_img_read on storage.objects for select to authenticated using (
  bucket_id = 'chat-images'
  and exists (select 1 from public.conversations c
              where c.id::text = (storage.foldername(name))[2] and auth.uid() in (c.owner_id, c.printer_id))
);
