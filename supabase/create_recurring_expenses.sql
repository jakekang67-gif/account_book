-- 정기 지출 테이블 (사용자별)
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.recurring_expenses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  amount integer not null check (amount > 0),
  category text not null,
  subcategory text not null,
  -- 몇 개월마다 한 번 (1=매월, 12=매년)
  interval_months integer not null default 1 check (interval_months >= 1 and interval_months <= 60),
  -- 첫 반영일 (이 날짜의 일자를 매 회차 지출일로 사용)
  start_date text not null,
  -- 마지막으로 지출에 반영한 달 (YYYY-MM). null이면 아직 없음
  last_applied_month text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_expenses_user_idx
  on public.recurring_expenses (user_id);

drop trigger if exists recurring_expenses_set_user_id on public.recurring_expenses;
create trigger recurring_expenses_set_user_id
  before insert on public.recurring_expenses
  for each row execute function public.set_auth_user_id();

alter table public.recurring_expenses enable row level security;

drop policy if exists "recurring_expenses_select_own" on public.recurring_expenses;
drop policy if exists "recurring_expenses_insert_own" on public.recurring_expenses;
drop policy if exists "recurring_expenses_update_own" on public.recurring_expenses;
drop policy if exists "recurring_expenses_delete_own" on public.recurring_expenses;

create policy "recurring_expenses_select_own"
  on public.recurring_expenses for select
  to authenticated
  using (user_id = auth.uid());

create policy "recurring_expenses_insert_own"
  on public.recurring_expenses for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "recurring_expenses_update_own"
  on public.recurring_expenses for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recurring_expenses_delete_own"
  on public.recurring_expenses for delete
  to authenticated
  using (user_id = auth.uid());
