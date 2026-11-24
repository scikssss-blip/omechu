-- AI 기능(유튜브 레시피, 사장님 대화)용 테이블
-- Supabase > SQL Editor > New snippet 에 붙여넣고 Run.

-- 유튜브 영상별로 한 번 정리한 레시피를 저장 (같은 영상은 다시 AI를 부르지 않음)
create table if not exists public.ai_recipes (
  video_id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ai_recipes enable row level security;
-- 앱(익명 키)은 직접 못 읽고 못 씀. 서버 함수(service role)만 사용.

-- 사람별 하루 사용 횟수
create table if not exists public.ai_usage (
  user_key text not null,
  kind text not null,
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  n integer not null default 0,
  primary key (user_key, kind, day)
);
alter table public.ai_usage enable row level security;

-- 한도 안이면 1 올리고 true, 넘으면 false
create or replace function public.ai_take(p_user_key text, p_kind text, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  insert into public.ai_usage(user_key, kind, day, n) values (p_user_key, p_kind, (now() at time zone 'Asia/Seoul')::date, 1)
  on conflict (user_key, kind, day) do update set n = public.ai_usage.n + 1
  returning n into v_n;
  return v_n <= p_limit;
end $$;
revoke all on function public.ai_take(text, text, integer) from public, anon, authenticated;

-- 서버 함수(service role)는 사용자 확인과 횟수 함수를 쓸 수 있게
grant execute on function public._owner_ok(text, text) to service_role;
grant execute on function public.ai_take(text, text, integer) to service_role;
grant select, insert, update on public.ai_recipes to service_role;
grant select, insert, update on public.ai_usage to service_role;
