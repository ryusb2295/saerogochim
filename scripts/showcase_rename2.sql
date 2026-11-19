-- 체험 계정(demo)에 앱으로 만든 한우랑 요청 3개도 떡볶이 가게 예시로 바꾼다. 한 번만 실행 (Supabase SQL Editor)
-- 실행 뒤 그림 교체: node scripts/seed_showcase.mjs --repair-previews
with m(old_title, new_title) as (values
  ('한우랑 포장 쇼핑백', '밤참떡볶이 포장 쇼핑백'),
  ('한우랑 원형 스티커', '달빛분식 원형 스티커'),
  ('한우랑 포장 상자 스티커', '꿈나라 떡볶이 포장 상자 스티커')
), r as (
  update public.print_requests p set title = m.new_title
  from m, public.profiles o
  where p.title = m.old_title and p.owner_id = o.id and o.username = 'demo'
  returning m.old_title, m.new_title
)
update public.notifications n set title = replace(n.title, '"' || r.old_title || '"', '"' || r.new_title || '"')
from r where n.title like '%"' || r.old_title || '"%';

select title, status from public.print_requests p join public.profiles o on o.id = p.owner_id where o.username = 'demo' order by p.created_at;
