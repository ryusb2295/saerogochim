-- 가게온: 파일 저장소 버킷과 접근 권한, 실시간 구독 대상. 설계: docs/PRINT_PLATFORM.md 2.7, 2.9
-- 경로 첫 폴더는 항상 업로드한 사용자 id. 모든 버킷은 비공개이고 서명 URL로만 내려받는다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('brand-assets', 'brand-assets', false, 5242880, array['image/png', 'image/webp']),
  ('request-files', 'request-files', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  ('request-previews', 'request-previews', false, 2097152, array['image/webp', 'image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 본인 폴더에만 올리고 지울 수 있음
create policy own_upload on storage.objects for insert to authenticated with check (
  bucket_id in ('brand-assets', 'request-files', 'request-previews')
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy own_delete on storage.objects for delete to authenticated using (
  bucket_id in ('brand-assets', 'request-files', 'request-previews')
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 브랜드 이미지: 본인만
create policy brand_read on storage.objects for select to authenticated using (
  bucket_id = 'brand-assets' and (storage.foldername(name))[1] = auth.uid()::text
);

-- 원본 파일: 요청 주인 + 견적이 수락된 인쇄소만
create policy original_read on storage.objects for select to authenticated using (
  bucket_id = 'request-files' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.print_requests r
               where r.design_path = storage.objects.name and public.accepted_shop(r.id) = public.my_shop_id())
  )
);

-- 워터마크 미리보기: 요청 주인 + verified 인쇄소(요청이 열려 있거나 자기 의뢰일 때)
create or replace function public.can_see_preview(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from print_requests r join print_shops s on s.owner_id = auth.uid() and s.verified
    where r.preview_path = p_path
      and (r.status = 'open' or public.accepted_shop(r.id) = s.id)
  )
$$;
grant execute on function public.can_see_preview(text) to authenticated;

create policy preview_read on storage.objects for select to authenticated using (
  bucket_id = 'request-previews' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.can_see_preview(name)
  )
);

-- 실시간: 새 메시지, 알림, 견적 도착을 화면에 바로 반영 (RLS가 그대로 적용됨)
alter publication supabase_realtime add table public.messages, public.notifications, public.quotations;
