-- Income & Expense Tracker schema
create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0 and amount <= 9999999999.99),
  category text not null check (char_length(category) between 1 and 60),
  description text not null default '' check (char_length(description) <= 240),
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);

alter table public.transactions enable row level security;

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
  on public.transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own transactions" on public.transactions;
create policy "Users can create own transactions"
  on public.transactions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.transactions to authenticated;
revoke all on public.transactions from anon;


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


-- Recurring income and expense schedules with row-level security.
create extension if not exists pgcrypto;

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0 and amount <= 9999999999.99),
  category text not null check (char_length(category) between 1 and 60),
  description text not null default '' check (char_length(description) <= 240),
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  start_date date not null,
  next_due_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index if not exists recurring_transactions_user_due_idx on public.recurring_transactions (user_id, next_due_date);
alter table public.recurring_transactions enable row level security;
drop policy if exists "Users can read own recurring transactions" on public.recurring_transactions;
create policy "Users can read own recurring transactions" on public.recurring_transactions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create own recurring transactions" on public.recurring_transactions;
create policy "Users can create own recurring transactions" on public.recurring_transactions for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own recurring transactions" on public.recurring_transactions;
create policy "Users can update own recurring transactions" on public.recurring_transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own recurring transactions" on public.recurring_transactions;
create policy "Users can delete own recurring transactions" on public.recurring_transactions for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.recurring_transactions to authenticated;
revoke all on public.recurring_transactions from anon;
