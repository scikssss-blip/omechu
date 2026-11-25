-- 말로 추천받기 문장 기록 (추리 개선용). 누가 썼는지는 저장하지 않음 — 이미 Supabase에 적용됨
create table if not exists public.talk_log (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) <= 80),
  found boolean not null default false,
  src text not null default 'rule',
  created_at timestamptz not null default now()
);
alter table public.talk_log enable row level security;
grant select, insert on public.talk_log to service_role;
create or replace function public.log_talk_miss(p_text text)
returns void language sql security definer set search_path = public as $$
  insert into public.talk_log(text, found, src) select left(trim(p_text), 80), false, 'rule' where char_length(trim(coalesce(p_text, ''))) between 2 and 80;
$$;
revoke all on function public.log_talk_miss(text) from public;
grant execute on function public.log_talk_miss(text) to anon, authenticated;
