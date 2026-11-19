-- 체험 계정(demo) 예시 인쇄 요청 이름을 떡볶이 가게 예시로 바꾼다. 한 번만 실행 (Supabase SQL Editor)
-- 실행 뒤 그림 교체: node scripts/seed_showcase.mjs --repair-previews
with m(old_title, new_title, new_note) as (values
  ('달빛 로스터리 원두 스티커', '달빛분식 포장 스티커', '떡볶이 포장 용기 뚜껑에 붙일 원형 스티커예요. 국물이 묻어도 번지지 않으면 좋겠어요.'),
  ('모락빵집 포장 쇼핑백', '밤참떡볶이 배달 봉투', '배달 용기 두세 개가 들어갈 크기예요. 손잡이는 종이끈으로 제작하고 싶어요.'),
  ('꽃담 플라워 꽃다발 포장지', '후루룩 국물떡볶이 포장지', '튀김을 싸는 종이로 쓸 거예요. 기름이 배어도 잉크가 번지지 않으면 좋겠어요.'),
  ('푸른숲 수제비누 라벨', '꿈나라 떡볶이 용기 라벨', '포장 용기 옆면에 붙일 라벨이에요. 냉장 보관해도 떨어지지 않게 해 주세요.'),
  ('꼬리별 반려견 간식 스티커', '달빛분식 단골 쿠폰 스티커', '쿠폰 도장 칸에 붙일 작은 스티커예요. 색감이 따뜻하게 나오면 좋겠습니다.')
), r as (
  update public.print_requests p set title = m.new_title, note = m.new_note
  from m, public.profiles o
  where p.title = m.old_title and p.owner_id = o.id and o.username = 'demo'
  returning m.old_title, m.new_title
)
update public.notifications n set title = replace(n.title, '"' || r.old_title || '"', '"' || r.new_title || '"')
from r where n.title like '%"' || r.old_title || '"%';

update public.profiles set display_name = '달빛분식' where username = 'demo';

select title, status from public.print_requests p join public.profiles o on o.id = p.owner_id where o.username = 'demo' order by p.created_at;
