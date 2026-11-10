-- 오메추: 닉네임 변경을 횟수 제한(3회) 대신 3일에 한 번으로
alter table public.users add column if not exists nick_changed_at timestamptz;
create or replace function public.set_my_nickname(p_user_key text, p_secret text, p_nick text)
returns text language plpgsql security definer set search_path = public as $$
declare last_at timestamptz;
begin
  if not public._owner_ok(p_user_key, p_secret) then return 'auth'; end if;
  if p_nick is null or length(trim(p_nick)) < 2 or length(trim(p_nick)) > 12 then return 'length'; end if;
  if exists (select 1 from public.users where nickname = trim(p_nick) and user_key <> p_user_key) then return 'taken'; end if;
  select nick_changed_at into last_at from public.users where user_key = p_user_key;
  if last_at is not null and last_at > now() - interval '3 days' then
    return 'wait:' || ceil(extract(epoch from (last_at + interval '3 days' - now())) / 3600)::int;
  end if;
  insert into public.users(user_key, nickname, nick_change_count, nick_changed_at) values (p_user_key, trim(p_nick), 1, now())
  on conflict (user_key) do update set nickname = excluded.nickname, nick_changed_at = now(),
    nick_change_count = coalesce(public.users.nick_change_count, 0) + 1;
  return 'ok';
end $$;
notify pgrst, 'reload schema';
