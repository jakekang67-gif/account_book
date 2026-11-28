-- 통장 잔액 테이블을 사용자별로 분리 (RLS)
-- Supabase SQL Editor에서 실행하세요.
-- (이미 create_balance_snapshots.sql 로 테이블을 만든 뒤 실행)

-- 1) 로그인 없이 넣었던 공용 데이터는 비움 (누가 소유인지 알 수 없음)
truncate table public.balance_snapshots restart identity;

-- 2) user_id 컬럼
alter table public.balance_snapshots
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists balance_snapshots_user_noted_at_idx
  on public.balance_snapshots (user_id, noted_at desc);

-- 3) insert 시 user_id 자동 설정 (expenses 등과 동일 함수)
drop trigger if exists balance_snapshots_set_user_id on public.balance_snapshots;
create trigger balance_snapshots_set_user_id
  before insert on public.balance_snapshots
  for each row execute function public.set_auth_user_id();

-- 4) RLS: 본인 행만 읽기/쓰기
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
