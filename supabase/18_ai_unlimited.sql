-- 기존 프로젝트의 SQL Editor에서 실행하여 AI 일일 제한을 해제한다.
-- p_limit은 이전 서버와의 호환성을 위해 유지하지만 사용하지 않는다.
-- 로그인, 관리자 AI 허용 검사와 사용량 기록은 유지한다.
create or replace function public.consume_ai(p_kind text, p_limit int) returns int
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_kind not in ('image', 'brand') then raise exception 'forbidden'; end if;
  if not coalesce((select ai_enabled from profiles where id = auth.uid()), false) then raise exception 'ai_disabled'; end if;
  insert into ai_usage (user_id, day, kind, used) values (auth.uid(), current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set used = ai_usage.used + 1;
  return -1;                       -- 일일 제한 없음
end $$;
