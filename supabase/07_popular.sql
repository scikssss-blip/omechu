-- 07) 인기 메뉴 집계: 3D 가게마다 'TOP 3'를 보여 주기 위한 기록
-- 무엇을 남기나: 메뉴 이름, 어디서 골랐는지(정했어 / 월드컵 우승 / 가게 테이블 월드컵), 가게 이름, 시각
-- 누가 골랐는지는 남기지 않음. 같은 기기가 같은 메뉴를 하루에 여러 번 넣는 것만 따로 막음(하루 지나면 지움).
-- Supabase 대시보드 > SQL Editor 에 이 파일 내용을 붙여 넣고 Run 한 번 누르면 됨.

create table if not exists public.pick_events (
  id bigserial primary key,
  menu text not null check (length(menu) between 1 and 40),
  kind text not null check (kind in ('decide', 'wc', 'pocha')),
  room text not null default '' check (length(room) <= 12),
  created_at timestamptz not null default now()
);
create index if not exists pick_events_menu_time on public.pick_events (menu, created_at desc);
alter table public.pick_events enable row level security;   -- 앱에서 직접 읽고 쓰는 길은 없음 (아래 함수로만)

create table if not exists public.pick_dedupe (
  user_key text not null,
  day date not null,
  menu text not null,
  kind text not null,
  primary key (user_key, day, menu, kind)
);
alter table public.pick_dedupe enable row level security;

-- 기록 남기기: 기기 확인 + 하루 같은 메뉴·같은 종류는 한 번만 + 하루 최대 40건
create or replace function public.log_pick(p_menu text, p_kind text, p_room text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
declare used int;
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if p_kind not in ('decide', 'wc', 'pocha') or length(coalesce(p_menu, '')) not between 1 and 40 then return false; end if;
  select count(*) into used from public.pick_dedupe where user_key = p_user_key and day = current_date;
  if used >= 40 then return false; end if;
  insert into public.pick_dedupe(user_key, day, menu, kind) values (p_user_key, current_date, p_menu, p_kind)
  on conflict do nothing;
  if not found then return false; end if;
  insert into public.pick_events(menu, kind, room) values (p_menu, p_kind, left(coalesce(p_room, ''), 12));
  delete from public.pick_dedupe where day < current_date - 1;
  return true;
end $$;
grant execute on function public.log_pick(text, text, text, text, text) to anon, authenticated;

-- 인기 TOP: 넘겨준 메뉴 목록 안에서 최근 p_days일 동안 많이 고른 순 (가게 테이블 월드컵은 2점)
create or replace function public.popular_menus(p_menus text[], p_days int default 14, p_limit int default 3)
returns table(menu text, score bigint) language sql stable security definer set search_path = public as $$
  select e.menu, sum(case when e.kind = 'pocha' then 2 else 1 end)::bigint as score
  from public.pick_events e
  where e.menu = any(p_menus) and e.created_at > now() - make_interval(days => least(greatest(p_days, 1), 60))
  group by e.menu
  order by score desc, max(e.created_at) desc
  limit least(greatest(p_limit, 1), 10);
$$;
grant execute on function public.popular_menus(text[], int, int) to anon, authenticated;

notify pgrst, 'reload schema';
