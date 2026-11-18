-- 월 예산 테이블 (사용자별)
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.monthly_budgets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create index if not exists monthly_budgets_user_month_idx
  on public.monthly_budgets (user_id, month);

drop trigger if exists monthly_budgets_set_user_id on public.monthly_budgets;
create trigger monthly_budgets_set_user_id
  before insert on public.monthly_budgets
  for each row execute function public.set_auth_user_id();

alter table public.monthly_budgets enable row level security;

drop policy if exists "monthly_budgets_select_own" on public.monthly_budgets;
drop policy if exists "monthly_budgets_insert_own" on public.monthly_budgets;
drop policy if exists "monthly_budgets_update_own" on public.monthly_budgets;
drop policy if exists "monthly_budgets_delete_own" on public.monthly_budgets;

create policy "monthly_budgets_select_own"
  on public.monthly_budgets for select
  to authenticated
  using (user_id = auth.uid());

create policy "monthly_budgets_insert_own"
  on public.monthly_budgets for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "monthly_budgets_update_own"
  on public.monthly_budgets for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "monthly_budgets_delete_own"
  on public.monthly_budgets for delete
  to authenticated
  using (user_id = auth.uid());
