-- 오메추: 보안 3차 (남은 직접 쓰기 막기 + 기기당 횟수 제한)

-- ── 1) 처음 닉네임 등록: 규칙(2~12자, 중복 금지)을 서버에서 확인 ──
create or replace function public.init_my_nickname(p_user_key text, p_secret text, p_nick text)
returns text language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if not public._owner_ok(p_user_key, p_secret) then return null; end if;
  select nickname into cur from public.users where user_key = p_user_key;
  if cur is not null then return cur; end if;               -- 이미 있으면 그대로
  if p_nick is null or length(trim(p_nick)) < 2 or length(trim(p_nick)) > 12
     or exists (select 1 from public.users where nickname = trim(p_nick)) then return null; end if;
  insert into public.users(user_key, nickname, nick_change_count) values (p_user_key, trim(p_nick), 0)
  on conflict (user_key) do nothing;
  return trim(p_nick);
end $$;
grant execute on function public.init_my_nickname(text, text, text) to anon, authenticated;

-- ── 2) 댓글: 작성자 기록, 닉네임 사칭 방지, 내 댓글 삭제, 하루 200개 ──
alter table public.comments add column if not exists user_key text;

create or replace function public.add_comment(p_id text, p_post_id text, p_nick text, p_avatar text, p_text text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_nick text;
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if coalesce(p_id, '') !~ '^c[0-9]{10,16}$' then return false; end if;
  if p_text is null or length(trim(p_text)) = 0 or length(p_text) > 1000 then return false; end if;
  if not exists (select 1 from public.posts where id = p_post_id) then return false; end if;
  if (select count(*) from public.comments where user_key = p_user_key and created_at > now() - interval '1 day') >= 200 then return false; end if;
  select nickname into v_nick from public.users where user_key = p_user_key;
  if v_nick is null then
    v_nick := left(trim(coalesce(p_nick, '익명')), 12);
    if v_nick = '' or exists (select 1 from public.users where nickname = v_nick) then v_nick := '익명'; end if;
  end if;
  insert into public.comments(id, post_id, nick, avatar, text, user_key)
  values (p_id, p_post_id, v_nick, left(coalesce(p_avatar, ''), 8), p_text, p_user_key)
  on conflict (id) do nothing;
  if not found then return false; end if;
  update public.posts set comments = (select count(*) from public.comments where post_id = p_post_id) where id = p_post_id;
  return true;
end $$;

create or replace function public.delete_my_comment(p_id text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_post text;
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  delete from public.comments where id = p_id and user_key = p_user_key returning post_id into v_post;
  if v_post is null then return false; end if;
  delete from public.comment_likes where comment_id = p_id;
  update public.posts set comments = (select count(*) from public.comments where post_id = v_post) where id = v_post;
  return true;
end $$;
grant execute on function public.delete_my_comment(text, text, text) to anon, authenticated;

-- ── 3) 오늘의 질문 투표: 기기당 하루 1표 ──
create unique index if not exists daily_q_votes_one_per_day on public.daily_q_votes(date_key, user_key);
create or replace function public.cast_daily_q(p_date_key text, p_opt integer, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if coalesce(p_date_key, '') !~ '^wmjDailyQ_[0-9]{4}_[0-9]{1,2}_[0-9]{1,2}$' or p_opt is null or p_opt < 0 or p_opt > 5 then return false; end if;
  insert into public.daily_q_votes(date_key, opt_idx, user_key) values (p_date_key, p_opt, p_user_key)
  on conflict (date_key, user_key) do nothing;
  return found;
end $$;
grant execute on function public.cast_daily_q(text, integer, text, text) to anon, authenticated;

-- ── 4) 메뉴 건의: 기기당 하루 10개 ──
create or replace function public.request_menu(p_name text, p_cat text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 30 then return false; end if;
  if (select count(*) from public.menu_requests where user_key = p_user_key and created_at > now() - interval '1 day') >= 10 then return false; end if;
  insert into public.menu_requests(name, cat, user_key) values (trim(p_name), left(coalesce(p_cat, 'all'), 12), p_user_key);
  return true;
end $$;
grant execute on function public.request_menu(text, text, text, text) to anon, authenticated;

-- ── 5) 추천 기록: 기기당 하루 300건 (기록 자체엔 기기 정보를 남기지 않음) ──
create table if not exists public.rec_quota (
  user_key text not null, day date not null default current_date, n int not null default 0,
  primary key (user_key, day)
);
alter table public.rec_quota enable row level security;
revoke all on public.rec_quota from anon, authenticated;

create or replace function public.log_recs(p_menus text[], p_cat text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
declare k int := coalesce(array_length(p_menus, 1), 0); used int;
begin
  if k = 0 or k > 5 or not public._owner_ok(p_user_key, p_secret) then return false; end if;
  insert into public.rec_quota(user_key, day, n) values (p_user_key, current_date, k)
  on conflict (user_key, day) do update set n = public.rec_quota.n + k returning n into used;
  if used > 300 then return false; end if;
  insert into public.rec_events(menu, cat) select left(m, 40), left(coalesce(p_cat, ''), 12) from unnest(p_menus) m where length(m) between 1 and 40;
  delete from public.rec_quota where day < current_date - 2;
  return true;
end $$;
grant execute on function public.log_recs(text[], text, text, text) to anon, authenticated;

-- ── 6) 메뉴 배틀 투표: 기기당 한 경기 1표 ──
create or replace function public.cast_battle(p_week integer, p_round integer, p_match integer, p_side text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if p_side not in ('a', 'b') or p_round not between 0 and 10 or p_match not between 0 and 64 then return false; end if;
  insert into public.battle_votes(week_seed, round_idx, match_idx, side, user_key) values (p_week, p_round, p_match, p_side, p_user_key)
  on conflict (week_seed, round_idx, match_idx, user_key) do nothing;
  return found;
end $$;
grant execute on function public.cast_battle(integer, integer, integer, text, text, text) to anon, authenticated;

-- ── 7) 앱에서 직접 넣는 길 막기 ──
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and cmd in ('INSERT', 'ALL')
             and tablename in ('users', 'daily_q_votes', 'menu_requests', 'rec_events', 'comments', 'battle_votes')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

notify pgrst, 'reload schema';
