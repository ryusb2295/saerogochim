-- 시연 전 정리: 공개 체험 계정(demo, demoprint)의 연습·테스트 데이터만 지운다.
-- 다른 사람 계정은 건드리지 않는다. Supabase SQL Editor에서 실행.
-- 지운 데이터는 되돌릴 수 없으니 ① 확인 → ② 정리 순서로 실행한다.

-- ① 확인만 (아무것도 지우지 않음)
select r.title, r.status, r.paid_at is not null as paid,
       case when r.title in ('밤참떡볶이 배달 봉투', '한우랑 원형 스티커', '한우랑 포장 쇼핑백',
                             '달빛분식 단골 쿠폰 스티커', '꿈나라 떡볶이 용기 라벨') then '남김' else '지움' end as action
from public.print_requests r join public.profiles p on p.id = r.owner_id
where p.username = 'demo' order by action, r.created_at;

select 'messages' as what, count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
  where c.owner_id in (select id from public.profiles where username in ('demo', 'demoprint'))
     or c.printer_id in (select id from public.profiles where username in ('demo', 'demoprint'))
union all
select 'notifications', count(*) from public.notifications
  where user_id in (select id from public.profiles where username in ('demo', 'demoprint'))
union all
select 'commerce_demo_orders', count(*) from public.commerce_demo_orders
  where owner_id in (select id from public.profiles where username = 'demo');


-- ② 정리 (위 결과를 보고 괜찮으면 아래만 선택해서 실행)
begin;

-- 시연에 쓰는 5개만 남기고 체험 사장님 요청 삭제 (견적·채팅방·메시지·리뷰는 함께 지워짐)
delete from public.print_requests r using public.profiles p
where p.id = r.owner_id and p.username = 'demo'
  and r.title not in ('밤참떡볶이 배달 봉투', '한우랑 원형 스티커', '한우랑 포장 쇼핑백',
                      '달빛분식 단골 쿠폰 스티커', '꿈나라 떡볶이 용기 라벨');

-- 제작 단계로 넘어간 주문은 결제 완료로 맞춘다 (제작중인데 결제 대기로 보이지 않게)
update public.print_requests r set paid_at = coalesce(r.paid_at, r.accepted_at, now())
from public.profiles p
where p.id = r.owner_id and p.username = 'demo' and r.status in ('in_progress', 'delivered', 'completed');

-- 연습 채팅 비우기
delete from public.messages m using public.conversations c
where c.id = m.conversation_id
  and (c.owner_id in (select id from public.profiles where username in ('demo', 'demoprint'))
    or c.printer_id in (select id from public.profiles where username in ('demo', 'demoprint')));
update public.conversations set last_message_at = null
where owner_id in (select id from public.profiles where username in ('demo', 'demoprint'));
delete from public.conversation_reads
where user_id in (select id from public.profiles where username in ('demo', 'demoprint'));

-- 제작중 주문 채팅방에 시연용 대화 몇 줄
with c as (
  select c.id, c.owner_id, c.printer_id from public.conversations c
  join public.print_requests r on r.id = c.request_id
  join public.profiles p on p.id = r.owner_id
  where p.username = 'demo' and r.title = '한우랑 원형 스티커'
)
insert into public.messages (conversation_id, sender_id, client_id, body, created_at)
select c.id, x.who, gen_random_uuid(), x.body, now() - x.ago
from c, lateral (values
  (c.owner_id,   '안녕하세요! 원형 스티커 1,000매 주문드렸어요.', interval '50 minutes'),
  (c.printer_id, '네 사장님, 시안 확인했습니다. 무광 코팅으로 진행할게요.', interval '45 minutes'),
  (c.owner_id,   '언제쯤 받을 수 있을까요?', interval '40 minutes'),
  (c.printer_id, '오늘 제작 시작해서 3일 안에 보내드릴게요!', interval '35 minutes')
) as x(who, body, ago);
update public.conversations c set last_message_at = (select max(created_at) from public.messages m where m.conversation_id = c.id)
where c.owner_id in (select id from public.profiles where username = 'demo');

-- 알림 비우기 (위 대화로 생긴 알림까지)
delete from public.notifications
where user_id in (select id from public.profiles where username in ('demo', 'demoprint'));

-- 시연 재주문·정기배송 모의 주문 비우기 (온 잔량은 그대로)
delete from public.commerce_demo_orders
where owner_id in (select id from public.profiles where username = 'demo');

commit;
