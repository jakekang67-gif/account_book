-- 통장 잔액 기준(스냅샷). Supabase SQL Editor에서 실행하세요.
create table if not exists public.balance_snapshots (
  id bigint generated always as identity primary key,
  amount integer not null,
  -- 이 시각 이후에 저장된 지출/수입만 잔액에 반영
  noted_at timestamptz not null default now()
);

create index if not exists balance_snapshots_noted_at_idx
  on public.balance_snapshots (noted_at desc);
