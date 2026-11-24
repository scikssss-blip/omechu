-- 커뮤니티 글·댓글 자동 필터 (욕설, 링크·연락처·광고, 같은 글자 도배)
-- 앱 쪽에서도 같은 규칙으로 먼저 막지만, 앱을 거치지 않고 직접 넣는 경우까지 서버에서 한 번 더 막습니다.
-- Supabase > SQL Editor > New snippet 에 붙여넣고 Run.

create or replace function public._text_blocked(t text)
returns boolean language sql immutable as $$
  select
    regexp_replace(coalesce(t, ''), '\s+', '', 'g') ~ '(시발|씨발|씨빨|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|좆|좇|존나|개새|[이저그씹]새끼|꺼져|닥쳐|섹스|느금|애미|애비|지랄|ㅈㄹ|염병|엠창|니미|씹|썅|미친놈|미친년|틀딱)'
    or coalesce(t, '') ~* '(https?://|www\.|open\.kakao|오픈\s?채팅|오픈\s?톡|텔레그램|카톡\s?(아이디|id)|라인\s?아이디|010[-\s.]?[0-9]{3,4}[-\s.]?[0-9]{4}|부업|수익\s?보장|고수익|대출|토토|카지노|바카라|도박)'
    or regexp_replace(coalesce(t, ''), '\s+', '', 'g') ~ '(.)\1{14,}'
$$;

create or replace function public._block_bad_text()
returns trigger language plpgsql as $$
begin
  if public._text_blocked(new.text) then
    raise exception 'blocked_text' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_posts_filter on public.posts;
create trigger trg_posts_filter before insert or update of text on public.posts
  for each row execute function public._block_bad_text();

drop trigger if exists trg_comments_filter on public.comments;
create trigger trg_comments_filter before insert or update of text on public.comments
  for each row execute function public._block_bad_text();
