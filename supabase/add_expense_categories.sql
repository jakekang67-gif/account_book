-- 기존 expenses 테이블에 대·소분류 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

alter table public.expenses
  add column if not exists category text,
  add column if not exists subcategory text;

create index if not exists expenses_category_idx
  on public.expenses (category);
