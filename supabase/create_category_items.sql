-- 대·소분류 편집용 테이블
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.category_items (
  id bigint generated always as identity primary key,
  category text not null,
  subcategory text not null,
  created_at timestamptz not null default now(),
  unique (category, subcategory)
);

create index if not exists category_items_category_idx
  on public.category_items (category);
