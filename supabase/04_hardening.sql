-- 오메추: 보안 2차 (신고·글쓰기는 서버 함수로만, 운영자 비밀번호 잠금)

-- ── 1) 신고: 내 기기 비밀값을 확인한 뒤에만 신고 1건 ──
create or replace function public.report_post(p_post_id text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if not exists (select 1 from public.posts where id = p_post_id) then return false; end if;
  insert into public.reports(post_id, user_key, reason) values (p_post_id, p_user_key, 'user_report')
  on conflict (post_id, user_key) do nothing;
  return true;
end $$;
grant execute on function public.report_post(text, text, text) to anon, authenticated;
drop policy if exists "reports_insert" on public.reports;

-- ── 2) 글쓰기: 작성자 ID는 내 것만, 좋아요·투표 수는 0부터, 내용 크기 제한 ──
create or replace function public._ok_imgs(p jsonb, max_n int, max_len int)
returns boolean language sql immutable as $$
  select p is null or (jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= max_n and not exists (
    select 1 from jsonb_array_elements(p) e
    where jsonb_typeof(e) <> 'string'
       or (e #>> '{}' <> '' and (e #>> '{}' !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' or length(e #>> '{}') > max_len))
  ));
$$;

create or replace function public.create_post(p_post jsonb, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_nick text; v_opts jsonb := p_post->'vote_options'; v_counts jsonb := null; v_text text := coalesce(p_post->>'text', '');
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if coalesce(p_post->>'id','') !~ '^p[0-9]{10,16}$' then return false; end if;
  if coalesce(p_post->>'type','') !~ '^[a-z]{1,12}$' then return false; end if;
  if length(v_text) > 2000 then return false; end if;
  if not public._ok_imgs(p_post->'imgs', 4, 450000) or not public._ok_imgs(p_post->'vote_imgs', 6, 250000) then return false; end if;
  -- 하루 30개까지
  if (select count(*) from public.posts where user_key = p_user_key and created_at > now() - interval '1 day') >= 30 then return false; end if;

  -- 투표 선택지: 문자열 2~6개, 각 40자 이하. 표 수는 서버가 0으로 만든다
  if v_opts is not null and jsonb_typeof(v_opts) = 'array' then
    if jsonb_array_length(v_opts) < 2 or jsonb_array_length(v_opts) > 6
       or exists (select 1 from jsonb_array_elements(v_opts) e where jsonb_typeof(e) <> 'string' or length(e #>> '{}') > 40) then
      return false;
    end if;
    select jsonb_agg(0) into v_counts from jsonb_array_elements(v_opts);
  else
    v_opts := null;
  end if;

  -- 닉네임: 등록된 내 닉네임이 있으면 그걸 쓰고, 남이 등록한 닉네임은 쓸 수 없다
  select nickname into v_nick from public.users where user_key = p_user_key;
  if v_nick is null then
    v_nick := left(trim(coalesce(p_post->>'nick', '익명')), 12);
    if v_nick = '' or exists (select 1 from public.users where nickname = v_nick) then v_nick := '익명'; end if;
  end if;

  insert into public.posts(id, type, nick, avatar, text, menu_tag, imgs, star, likes, comments,
                           vote_options, vote_counts, vote_imgs, vote_deadline, is_anonymous, user_key)
  values (p_post->>'id', p_post->>'type', v_nick, left(coalesce(p_post->>'avatar', ''), 8), v_text,
          nullif(left(coalesce(p_post->>'menu_tag', ''), 30), ''),
          coalesce(p_post->'imgs', '[]'::jsonb),
          greatest(0, least(5, coalesce((p_post->>'star')::int, 0))), 0, 0,
          v_opts, v_counts, case when v_opts is null then null else p_post->'vote_imgs' end,
          case when v_opts is null then null else (p_post->>'vote_deadline')::bigint end,
          coalesce((p_post->>'is_anonymous')::boolean, false), p_user_key)
  on conflict (id) do nothing;
  return found;
end $$;
grant execute on function public.create_post(jsonb, text, text) to anon, authenticated;

-- 글 수정도 같은 크기 제한
create or replace function public.update_my_post(p_id text, p_user_key text, p_secret text, p_text text, p_menu_tag text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if length(coalesce(p_text, '')) > 2000 then return false; end if;
  update public.posts set text = p_text, menu_tag = nullif(left(coalesce(p_menu_tag, ''), 30), '')
  where id = p_id and user_key = p_user_key;
  return found;
end $$;

-- 앱에서 posts에 직접 넣는 길 막기
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'posts' and cmd in ('INSERT', 'ALL')
  loop execute format('drop policy %I on public.posts', r.policyname); end loop;
end $$;

-- ── 3) 운영자 비밀번호: 5번 틀리면 10분 잠금 (모든 운영자 함수에 적용) ──
alter table public.admin_config add column if not exists fails int not null default 0;
alter table public.admin_config add column if not exists locked_until timestamptz;

create or replace function public._admin_ok(p_pass text)
returns boolean language plpgsql volatile security definer set search_path = public, extensions as $$
declare cfg record;
begin
  select * into cfg from public.admin_config where id = 1 for update;
  if not found then return false; end if;
  if cfg.locked_until is not null and cfg.locked_until > now() then return false; end if;
  if cfg.pass_hash = encode(extensions.digest(coalesce(p_pass, ''), 'sha256'), 'hex') then
    if cfg.fails <> 0 then update public.admin_config set fails = 0, locked_until = null where id = 1; end if;
    return true;
  end if;
  update public.admin_config
     set fails = case when cfg.fails + 1 >= 5 then 0 else cfg.fails + 1 end,
         locked_until = case when cfg.fails + 1 >= 5 then now() + interval '10 minutes' else locked_until end
   where id = 1;
  return false;
end $$;
revoke all on function public._admin_ok(text) from public, anon, authenticated;

-- 잠겨 있는지 화면에 알려주기 위한 함수
create or replace function public.admin_locked()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(greatest(0, ceil(extract(epoch from (locked_until - now())) / 60))::int, 0) from public.admin_config where id = 1;
$$;
grant execute on function public.admin_locked() to anon, authenticated;

notify pgrst, 'reload schema';
