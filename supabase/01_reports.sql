-- 오메추: 신고 테이블 (Supabase > SQL Editor에 붙여넣고 Run)
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  post_id text not null,
  user_key text not null,
  reason text default 'user_report',
  created_at timestamptz not null default now(),
  unique (post_id, user_key)          -- 같은 사람이 같은 글을 여러 번 신고해도 1건
);

alter table public.reports enable row level security;

-- 누구나 신고 가능, 신고 수 집계를 위해 post_id 조회 가능. 수정·삭제는 불가.
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports for insert to anon, authenticated with check (true);
drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports for select to anon, authenticated using (true);
