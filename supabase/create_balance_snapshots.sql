-- 통장 잔액 기준(스냅샷) — 사용자별 + RLS
-- Supabase SQL Editor에서 실행하세요.
-- (테이블이 이미 있으면 enable_balance_snapshots_rls.sql 을 실행하세요.)

create table if not exists public.balance_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  -- 이 시각 이후에 저장된 지출/수입만 잔액에 반영
  noted_at timestamptz not null default now()
);

create index if not exists balance_snapshots_user_noted_at_idx
  on public.balance_snapshots (user_id, noted_at desc);

drop trigger if exists balance_snapshots_set_user_id on public.balance_snapshots;
create trigger balance_snapshots_set_user_id
  before insert on public.balance_snapshots
  for each row execute function public.set_auth_user_id();

alter table public.balance_snapshots enable row level security;

drop policy if exists "balance_snapshots_select_own" on public.balance_snapshots;
drop policy if exists "balance_snapshots_insert_own" on public.balance_snapshots;
drop policy if exists "balance_snapshots_update_own" on public.balance_snapshots;
drop policy if exists "balance_snapshots_delete_own" on public.balance_snapshots;

create policy "balance_snapshots_select_own"
  on public.balance_snapshots for select
  to authenticated
  using (user_id = auth.uid());

create policy "balance_snapshots_insert_own"
  on public.balance_snapshots for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "balance_snapshots_update_own"
  on public.balance_snapshots for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "balance_snapshots_delete_own"
  on public.balance_snapshots for delete
  to authenticated
  using (user_id = auth.uid());
