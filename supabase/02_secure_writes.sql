-- 오메추: 쓰기 권한 잠그기
-- 1) 각 기기는 처음 접속할 때 비밀값(secret)을 하나 등록하고, 수정·삭제·좋아요·투표는
--    이 비밀값을 확인하는 서버 함수(RPC)로만 할 수 있게 바꾼다.
-- 2) 누구나 남의 글·댓글·프로필을 고치거나 지울 수 있던 정책을 없앤다.

create extension if not exists pgcrypto;

-- 댓글 수 칸 (앱이 읽는데 없던 칸)
alter table public.posts add column if not exists comments integer not null default 0;

-- ── 비밀값 저장소 (앱에서 직접 읽을 수 없음) ──
create table if not exists public.user_secrets (
  user_key text primary key,
  secret_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.user_secrets enable row level security;  -- 정책 없음 = 앱에서 접근 불가
revoke all on public.user_secrets from anon, authenticated;

-- 내부용: 비밀값 확인
create or replace function public._owner_ok(p_user_key text, p_secret text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.user_secrets
    where user_key = p_user_key and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  );
$$;
revoke all on function public._owner_ok(text, text) from public, anon, authenticated;

-- 처음 접속 시 비밀값 등록 (이미 등록돼 있으면 일치하는지만 확인)
create or replace function public.register_owner(p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_user_key is null or length(p_user_key) < 8 or p_secret is null or length(p_secret) < 16 then
    return false;
  end if;
  insert into public.user_secrets(user_key, secret_hash)
  values (p_user_key, encode(extensions.digest(p_secret, 'sha256'), 'hex'))
  on conflict (user_key) do nothing;
  return public._owner_ok(p_user_key, p_secret);
end $$;

-- 내 글 수정
create or replace function public.update_my_post(p_id text, p_user_key text, p_secret text, p_text text, p_menu_tag text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  update public.posts set text = p_text, menu_tag = p_menu_tag where id = p_id and user_key = p_user_key;
  return found;
end $$;

-- 내 글 삭제 (댓글·좋아요도 같이 정리)
create or replace function public.delete_my_post(p_id text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  delete from public.posts where id = p_id and user_key = p_user_key;
  if not found then return false; end if;
  delete from public.comment_likes where comment_id in (select id from public.comments where post_id = p_id);
  delete from public.comments where post_id = p_id;
  delete from public.likes where target_id = p_id;
  return true;
end $$;

-- 글 좋아요 / 취소 (좋아요 수는 실제 기록 수로 다시 계산)
create or replace function public.toggle_post_like(p_post_id text, p_user_key text, p_secret text, p_like boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public._owner_ok(p_user_key, p_secret) then return null; end if;
  if p_like then
    insert into public.likes(target_id, target_type, user_key) values (p_post_id, 'post', p_user_key)
    on conflict (target_id, target_type, user_key) do nothing;
  else
    delete from public.likes where target_id = p_post_id and target_type = 'post' and user_key = p_user_key;
  end if;
  select count(*) into n from public.likes where target_id = p_post_id and target_type = 'post';
  update public.posts set likes = n where id = p_post_id;
  return n;
end $$;

-- 댓글 쓰기 (댓글 수 다시 계산)
create or replace function public.add_comment(p_id text, p_post_id text, p_nick text, p_avatar text, p_text text, p_user_key text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._owner_ok(p_user_key, p_secret) then return false; end if;
  if p_text is null or length(trim(p_text)) = 0 or length(p_text) > 1000 then return false; end if;
  insert into public.comments(id, post_id, nick, avatar, text) values (p_id, p_post_id, p_nick, p_avatar, p_text);
  update public.posts set comments = (select count(*) from public.comments where post_id = p_post_id) where id = p_post_id;
  return true;
end $$;

-- 댓글 좋아요 / 취소
create or replace function public.toggle_comment_like(p_comment_id text, p_user_key text, p_secret text, p_like boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public._owner_ok(p_user_key, p_secret) then return null; end if;
  if p_like then
    insert into public.comment_likes(comment_id, user_key) values (p_comment_id, p_user_key)
    on conflict (comment_id, user_key) do nothing;
  else
    delete from public.comment_likes where comment_id = p_comment_id and user_key = p_user_key;
  end if;
  select count(*) into n from public.comment_likes where comment_id = p_comment_id;
  update public.comments set likes = n where id = p_comment_id;
  return n;
end $$;

-- 투표 (1인 1표, 서버에서 한 칸만 +1)
create or replace function public.cast_vote(p_post_id text, p_choice integer, p_user_key text, p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare counts jsonb;
begin
  if not public._owner_ok(p_user_key, p_secret) then return null; end if;
  insert into public.likes(target_id, target_type, user_key) values (p_post_id, 'vote', p_user_key)
  on conflict (target_id, target_type, user_key) do nothing;
  if not found then
    select vote_counts into counts from public.posts where id = p_post_id;
    return counts;  -- 이미 투표함
  end if;
  update public.posts
     set vote_counts = jsonb_set(vote_counts, array[p_choice::text],
                                 to_jsonb(coalesce((vote_counts->>p_choice)::int, 0) + 1))
   where id = p_post_id and vote_counts is not null
     and p_choice >= 0 and p_choice < jsonb_array_length(vote_counts)
  returning vote_counts into counts;
  return counts;
end $$;

-- 닉네임 변경 (3회 제한, 중복 금지)
create or replace function public.set_my_nickname(p_user_key text, p_secret text, p_nick text)
returns text language plpgsql security definer set search_path = public as $$
declare cnt integer;
begin
  if not public._owner_ok(p_user_key, p_secret) then return 'auth'; end if;
  if p_nick is null or length(trim(p_nick)) < 2 or length(trim(p_nick)) > 12 then return 'length'; end if;
  if exists (select 1 from public.users where nickname = trim(p_nick) and user_key <> p_user_key) then return 'taken'; end if;
  select coalesce(nick_change_count, 0) into cnt from public.users where user_key = p_user_key;
  if cnt >= 3 then return 'limit'; end if;
  insert into public.users(user_key, nickname, nick_change_count) values (p_user_key, trim(p_nick), 1)
  on conflict (user_key) do update set nickname = excluded.nickname,
    nick_change_count = coalesce(public.users.nick_change_count, 0) + 1;
  return 'ok';
end $$;

grant execute on function public.register_owner(text, text) to anon, authenticated;
grant execute on function public.update_my_post(text, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_my_post(text, text, text) to anon, authenticated;
grant execute on function public.toggle_post_like(text, text, text, boolean) to anon, authenticated;
grant execute on function public.add_comment(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.toggle_comment_like(text, text, text, boolean) to anon, authenticated;
grant execute on function public.cast_vote(text, integer, text, text) to anon, authenticated;
grant execute on function public.set_my_nickname(text, text, text) to anon, authenticated;

-- ── 위험한 정책 제거: 앱에서 직접 수정·삭제 금지 (함수로만 가능) ──
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and ((tablename in ('posts','comments','users') and cmd in ('UPDATE','DELETE'))
               or (tablename in ('likes','comment_likes') and cmd in ('INSERT','UPDATE','DELETE'))
               or (tablename = 'comments' and cmd = 'INSERT'))
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

notify pgrst, 'reload schema';
