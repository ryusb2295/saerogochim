-- 가게온: 거래 후기와 인쇄소 평점
-- Supabase SQL Editor에서 한 번 실행한다. 다시 실행해도 된다.

-- 완료된 의뢰 하나에 후기 하나. 쓴 사람은 이름 첫 글자만 보여준다
create table if not exists public.reviews (
  request_id uuid primary key references public.print_requests(id) on delete cascade,
  shop_id uuid not null references public.print_shops(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text check (char_length(body) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists reviews_shop on public.reviews (shop_id, created_at desc);

-- 화면에 보여줄 가린 이름 (예: 한○○). 다른 사람은 profiles를 읽을 수 없어서 후기를 쓸 때 만들어 둔다
alter table public.reviews add column if not exists author text check (char_length(author) <= 10);
update public.reviews r set author = left(p.display_name, 1) || '○○'
  from public.profiles p where p.id = r.owner_id and r.author is null;

alter table public.reviews enable row level security;
revoke all on public.reviews from anon;
revoke insert, update, delete on public.reviews from authenticated;   -- 쓰기는 write_review 함수로만
grant select on public.reviews to authenticated;

-- 견적을 고를 때 참고하도록 로그인한 사람은 모두 읽을 수 있다
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select to authenticated using (true);

-- 후기 쓰기: 요청 주인이, 완료된 의뢰에, 한 번만. 수정과 삭제는 없다
create or replace function public.write_review(p_request uuid, p_rating int, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare req print_requests; shop print_shops;
begin
  select * into req from print_requests where id = p_request;
  if req.id is null or req.owner_id <> auth.uid() or req.status <> 'completed' then raise exception 'forbidden'; end if;
  select s.* into shop from quotations q join print_shops s on s.id = q.shop_id where q.id = req.accepted_quotation_id;
  if shop.id is null then raise exception 'forbidden'; end if;
  insert into reviews (request_id, shop_id, owner_id, rating, body, author)
  values (req.id, shop.id, auth.uid(), p_rating, nullif(trim(p_body), ''),
          (select left(display_name, 1) || '○○' from profiles where id = auth.uid()))
  on conflict (request_id) do nothing;
  if found then
    perform notify(shop.owner_id, 'status_changed', req.id, '"' || req.title || '" 후기가 등록됐어요 (별점 ' || p_rating || '점)');
  end if;
end $$;
grant execute on function public.write_review(uuid, int, text) to authenticated;
