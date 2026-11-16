-- Supabase SQL Editor에서 이 쿼리를 실행하세요.
-- expenses: 가계부 지출 내역 테이블

create table if not exists public.expenses (
  -- 자동 생성되는 고유 번호
  id bigint generated always as identity primary key,

  -- 행이 만들어진 시각 (UTC)
  created_at timestamptz not null default now(),

  -- 지출 날짜 (예: 2026-11-15)
  date text not null,

  -- 지출 금액 (정수, 원 단위)
  amount integer not null,

  -- 지출 내용
  description text not null,

  -- 대분류 (예: 교통비)
  category text,

  -- 소분류 (예: 택시)
  subcategory text
);

-- 최신 내역부터 보기 쉽도록 생성 시간 인덱스
create index if not exists expenses_created_at_idx
  on public.expenses (created_at desc);

create index if not exists expenses_category_idx
  on public.expenses (category);
