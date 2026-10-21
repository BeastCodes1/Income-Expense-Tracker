-- Run this file in Supabase SQL Editor to enable monthly category budgets.
create extension if not exists pgcrypto;


-- Monthly expense budgets. Each signed-in user can only access their own rows.
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 60),
  month date not null check (extract(day from month) = 1),
  amount numeric(12,2) not null check (amount > 0 and amount <= 9999999999.99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_unique_user_category_month unique (user_id, category, month)
);

create index if not exists budgets_user_month_idx on public.budgets (user_id, month);
alter table public.budgets enable row level security;
drop policy if exists "Users can read own budgets" on public.budgets;
create policy "Users can read own budgets" on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create own budgets" on public.budgets;
create policy "Users can create own budgets" on public.budgets for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own budgets" on public.budgets;
create policy "Users can update own budgets" on public.budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own budgets" on public.budgets;
create policy "Users can delete own budgets" on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.budgets to authenticated;
revoke all on public.budgets from anon;
