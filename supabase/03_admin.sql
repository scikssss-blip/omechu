-- 오메추: 운영자 기능 + 메뉴 건의/추천 기록 저장
-- 관리자 비밀번호는 해시로만 저장되며, 모든 관리 기능은 비밀번호를 확인하는 서버 함수로만 동작한다.

-- ── 메뉴 건의 (앱은 쓰기만, 읽기는 관리자 함수로) ──
create table if not exists public.menu_requests (
  id bigint generated always as identity primary key,
  name text not null check (length(name) between 1 and 30),
  cat text default 'all',
  user_key text,
  created_at timestamptz not null default now()
);
alter table public.menu_requests enable row level security;
drop policy if exists "menu_requests_insert" on public.menu_requests;
create policy "menu_requests_insert" on public.menu_requests for insert to anon, authenticated with check (true);

-- ── 추천 기록 (어떤 메뉴가 많이 추천되는지, 개인 식별 정보 없음) ──
create table if not exists public.rec_events (
  id bigint generated always as identity primary key,
  menu text not null,
  cat text,
  created_at timestamptz not null default now()
);
alter table public.rec_events enable row level security;
drop policy if exists "rec_events_insert" on public.rec_events;
create policy "rec_events_insert" on public.rec_events for insert to anon, authenticated with check (length(menu) <= 40);

-- ── 신고 기록은 누가 신고했는지 보이지 않게: 직접 조회 막고 개수만 알려주는 함수로 ──
drop policy if exists "reports_select" on public.reports;
create or replace function public.report_counts()
returns table(post_id text, cnt bigint) language sql stable security definer set search_path = public as $$
  select post_id, count(*) from public.reports group by post_id;
$$;
grant execute on function public.report_counts() to anon, authenticated;

-- ── 관리자 비밀번호 ──
create table if not exists public.admin_config (
  id int primary key default 1 check (id = 1),
  pass_hash text not null
);
alter table public.admin_config enable row level security;
revoke all on public.admin_config from anon, authenticated;

create or replace function public._admin_ok(p_pass text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.admin_config where id = 1 and pass_hash = encode(extensions.digest(coalesce(p_pass,''), 'sha256'), 'hex'));
$$;
revoke all on function public._admin_ok(text) from public, anon, authenticated;

create or replace function public.admin_login(p_pass text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform pg_sleep(0.5);  -- 무차별 대입 속도 늦추기
  return public._admin_ok(p_pass);
end $$;

create or replace function public.admin_change_password(p_pass text, p_new text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._admin_ok(p_pass) or length(coalesce(p_new,'')) < 10 then return false; end if;
  update public.admin_config set pass_hash = encode(extensions.digest(p_new, 'sha256'), 'hex') where id = 1;
  return true;
end $$;

create or replace function public.admin_stats(p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._admin_ok(p_pass) then return null; end if;
  return jsonb_build_object(
    'devices',        (select count(*) from public.user_secrets),
    'devices_7d',     (select count(*) from public.user_secrets where created_at > now() - interval '7 days'),
    'posts',          (select count(*) from public.posts),
    'posts_7d',       (select count(*) from public.posts where created_at > now() - interval '7 days'),
    'comments',       (select count(*) from public.comments),
    'likes',          (select count(*) from public.likes where target_type = 'post'),
    'reports_open',   (select count(distinct post_id) from public.reports),
    'menu_requests',  (select count(*) from public.menu_requests),
    'recs_7d',        (select count(*) from public.rec_events where created_at > now() - interval '7 days')
  );
end $$;

create or replace function public.admin_reported_posts(p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._admin_ok(p_pass) then return null; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'last_report' desc) from (
      select jsonb_build_object('id', p.id, 'nick', p.nick, 'text', p.text, 'type', p.type, 'imgs', p.imgs,
             'created_at', p.created_at, 'reports', r.cnt, 'last_report', r.last_at) as x
      from (select post_id, count(*) cnt, max(created_at) last_at from public.reports group by post_id) r
      join public.posts p on p.id = r.post_id
    ) s), '[]'::jsonb);
end $$;

create or replace function public.admin_recent_posts(p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._admin_ok(p_pass) then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nick', nick, 'text', text, 'type', type,
           'created_at', created_at, 'likes', likes, 'comments', comments) order by created_at desc)
         from (select * from public.posts order by created_at desc limit 50) p), '[]'::jsonb);
end $$;

create or replace function public.admin_delete_post(p_pass text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._admin_ok(p_pass) then return false; end if;
  delete from public.comment_likes where comment_id in (select id from public.comments where post_id = p_id);
  delete from public.comments where post_id = p_id;
  delete from public.likes where target_id = p_id;
  delete from public.reports where post_id = p_id;
  delete from public.posts where id = p_id;
  return found;
end $$;

create or replace function public.admin_clear_reports(p_pass text, p_post_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._admin_ok(p_pass) then return false; end if;
  delete from public.reports where post_id = p_post_id;
  return true;
end $$;

create or replace function public.admin_menu_requests(p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._admin_ok(p_pass) then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', cnt, 'cats', cats, 'last', last_at) order by cnt desc, last_at desc)
    from (select name, count(*) cnt, array_agg(distinct cat) cats, max(created_at) last_at
          from public.menu_requests group by name) m), '[]'::jsonb);
end $$;

create or replace function public.admin_delete_menu_request(p_pass text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._admin_ok(p_pass) then return false; end if;
  delete from public.menu_requests where name = p_name;
  return true;
end $$;

create or replace function public.admin_top_menus(p_pass text, p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._admin_ok(p_pass) then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('menu', menu, 'count', cnt) order by cnt desc)
    from (select menu, count(*) cnt from public.rec_events
          where created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
          group by menu order by cnt desc limit 20) t), '[]'::jsonb);
end $$;

grant execute on function public.admin_login(text) to anon, authenticated;
grant execute on function public.admin_change_password(text, text) to anon, authenticated;
grant execute on function public.admin_stats(text) to anon, authenticated;
grant execute on function public.admin_reported_posts(text) to anon, authenticated;
grant execute on function public.admin_recent_posts(text) to anon, authenticated;
grant execute on function public.admin_delete_post(text, text) to anon, authenticated;
grant execute on function public.admin_clear_reports(text, text) to anon, authenticated;
grant execute on function public.admin_menu_requests(text) to anon, authenticated;
grant execute on function public.admin_delete_menu_request(text, text) to anon, authenticated;
grant execute on function public.admin_top_menus(text, int) to anon, authenticated;

-- 처음 비밀번호 등록 (해시만 저장). 이미 있으면 그대로 둔다.
insert into public.admin_config(id, pass_hash) values (1, '__PASS_HASH__') on conflict (id) do nothing;

notify pgrst, 'reload schema';
