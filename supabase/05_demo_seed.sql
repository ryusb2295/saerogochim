-- 시연용: 인쇄소 계정 두 개를 화면에서 가입한 뒤 실행한다 (비밀번호는 저장소에 넣지 않음).
-- 견적 제출은 verified 인쇄소만 가능하다. 출시 때는 사업자 확인 후 관리자가 바꾼다.
update public.print_shops set verified = true,
  region_sido = coalesce(region_sido, '대구'), region_sigungu = coalesce(region_sigungu, '북구'),
  items = case when items = '{}' then array['sticker', 'shopping_bag', 'wrapping'] else items end
where owner_id in (select id from public.profiles where username in ('printer01', 'printer02'));
