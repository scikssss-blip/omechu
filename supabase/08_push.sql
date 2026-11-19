-- 08) 점심·저녁 '오늘 뭐 먹지' 알림 구독
-- 무엇을 남기나: 브라우저가 알려 준 알림 주소(endpoint)와 암호 키, 받고 싶은 시간대(점심/저녁)
-- 이름·연락처는 없음. 알림을 끄면 바로 지워짐. 알림 주소가 죽으면(앱 삭제 등) 보내는 쪽에서 지움.
-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 Run.

create table if not exists public.push_subs (
  endpoint text primary key check (length(endpoint) between 20 and 600),
  p256dh text not null check (length(p256dh) between 20 and 200),
  auth text not null check (length(auth) between 8 and 100),
  slots text[] not null default array['lunch', 'dinner'],
  user_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subs (user_key);
alter table public.push_subs enable row level security;   -- 앱에서 직접 읽고 쓰는 길 없음

create or replace function public.save_push_sub(p_endpoint text, p_p256dh text, p_auth text, p_slots text[], p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if p_endpoint !~ '^https://' then return false; end if;
  if (select count(*) from public.push_subs where user_key = p_user_key and endpoint <> p_endpoint) >= 3 then return false; end if;
  insert into public.push_subs(endpoint, p256dh, auth, slots, user_key)
  values (p_endpoint, p_p256dh, p_auth, (select coalesce(array_agg(s), array[]::text[]) from unnest(p_slots) s where s in ('lunch', 'dinner')), p_user_key)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, slots = excluded.slots, user_key = excluded.user_key;
  return true;
end $$;
grant execute on function public.save_push_sub(text, text, text, text[], text, text) to anon, authenticated;

create or replace function public.delete_push_sub(p_endpoint text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  delete from public.push_subs where endpoint = p_endpoint and user_key = p_user_key;
  return true;
end $$;
grant execute on function public.delete_push_sub(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 보내는 시간 예약 (Edge Function 'daily-push'를 올린 다음에 실행) ──
-- Database > Extensions 에서 pg_cron, pg_net 을 켠 뒤, 아래 두 줄의 <프로젝트주소>와 <CRON_SECRET>을 바꿔서 실행.
-- 한국 11:30 = UTC 02:30, 한국 17:30 = UTC 08:30
-- select cron.schedule('omechu-lunch',  '30 2 * * *', $$ select net.http_post(url := 'https://<프로젝트주소>.supabase.co/functions/v1/daily-push', headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb, body := '{"slot":"lunch"}'::jsonb) $$);
-- select cron.schedule('omechu-dinner', '30 8 * * *', $$ select net.http_post(url := 'https://<프로젝트주소>.supabase.co/functions/v1/daily-push', headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb, body := '{"slot":"dinner"}'::jsonb) $$);
