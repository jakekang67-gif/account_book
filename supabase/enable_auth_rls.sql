-- 이메일 로그인 + 사용자별 장부 (1단계)
-- Supabase SQL Editor에서 실행하세요.
-- 주의: 기존 expenses / category_items 데이터를 삭제하고 새로 시작합니다.

-- 1) 기존 데이터 비우기 (이전하지 않음)
truncate table public.expenses restart identity cascade;
truncate table public.category_items restart identity cascade;

-- 2) user_id 컬럼
alter table public.expenses
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.category_items
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists category_items_user_id_idx on public.category_items (user_id);

-- 3) 카테고리 유니크: 사용자별로 (category, subcategory)
alter table public.category_items
  drop constraint if exists category_items_category_subcategory_key;

alter table public.category_items
  drop constraint if exists category_items_user_category_subcategory_key;

alter table public.category_items
  add constraint category_items_user_category_subcategory_key
  unique (user_id, category, subcategory);

-- 4) insert 시 user_id 자동 설정
create or replace function public.set_auth_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if new.user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if new.user_id <> auth.uid() then
    raise exception '다른 사용자 명의로 저장할 수 없습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_set_user_id on public.expenses;
create trigger expenses_set_user_id
  before insert on public.expenses
  for each row execute function public.set_auth_user_id();

drop trigger if exists category_items_set_user_id on public.category_items;
create trigger category_items_set_user_id
  before insert on public.category_items
  for each row execute function public.set_auth_user_id();

-- 5) RLS
alter table public.expenses enable row level security;
alter table public.category_items enable row level security;

drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;

create policy "expenses_select_own"
  on public.expenses for select
  to authenticated
  using (user_id = auth.uid());

create policy "expenses_insert_own"
  on public.expenses for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "expenses_update_own"
  on public.expenses for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "expenses_delete_own"
  on public.expenses for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "category_items_select_own" on public.category_items;
drop policy if exists "category_items_insert_own" on public.category_items;
drop policy if exists "category_items_update_own" on public.category_items;
drop policy if exists "category_items_delete_own" on public.category_items;

create policy "category_items_select_own"
  on public.category_items for select
  to authenticated
  using (user_id = auth.uid());

create policy "category_items_insert_own"
  on public.category_items for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "category_items_update_own"
  on public.category_items for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "category_items_delete_own"
  on public.category_items for delete
  to authenticated
  using (user_id = auth.uid());
