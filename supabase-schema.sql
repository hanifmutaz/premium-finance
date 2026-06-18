-- ============================================================
-- MIGRATION: Add Budget & Receivables (Piutang) modules
-- Jalankan di Supabase SQL Editor. Aman dijalankan di project
-- yang sudah punya data — tidak menghapus apapun.
-- ============================================================

-- ─── RECEIVABLES (Piutang) ────────────────────────────────────────────────────
create table if not exists public.receivables (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  name            text not null,
  borrower        text not null,
  total_amount    numeric(15, 2) not null check (total_amount > 0),
  total_received  numeric(15, 2) not null default 0 check (total_received >= 0),
  remaining       numeric(15, 2) generated always as (total_amount - total_received) stored,
  start_date      date not null default current_date,
  due_date        date not null,
  priority        text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status          text not null default 'active' check (status in ('active', 'completed', 'overdue')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.receivable_payments (
  id              uuid primary key default uuid_generate_v4(),
  receivable_id   uuid references public.receivables(id) on delete cascade not null,
  amount          numeric(15, 2) not null check (amount > 0),
  date            date not null default current_date,
  notes           text,
  created_at      timestamptz not null default now()
);

alter table public.receivables enable row level security;
drop policy if exists "Users manage own receivables" on public.receivables;
create policy "Users manage own receivables" on public.receivables
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.receivable_payments enable row level security;
drop policy if exists "Users manage own receivable payments" on public.receivable_payments;
create policy "Users manage own receivable payments" on public.receivable_payments
  for all using (
    receivable_id in (select id from public.receivables where user_id = auth.uid())
  );

create index if not exists idx_receivables_user_id on public.receivables(user_id);
create index if not exists idx_receivables_status on public.receivables(status);

-- ─── BUDGETS ──────────────────────────────────────────────────────────────────
create table if not exists public.budgets (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references public.profiles(id) on delete cascade not null,
  name              text not null,
  period            text not null check (period in ('monthly', 'weekly')),
  year              integer not null,
  month             integer check (month between 1 and 12),
  week              integer check (week between 1 and 53),
  total_income      numeric(15, 2) not null default 0,
  total_planned     numeric(15, 2) not null default 0,
  total_actual      numeric(15, 2) not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.budget_categories (
  id              uuid primary key default uuid_generate_v4(),
  budget_id       uuid references public.budgets(id) on delete cascade not null,
  name            text not null,
  planned_amount  numeric(15, 2) not null default 0,
  actual_amount   numeric(15, 2) not null default 0,
  color           text default '#64748B',
  created_at      timestamptz not null default now()
);

alter table public.budgets enable row level security;
drop policy if exists "Users manage own budgets" on public.budgets;
create policy "Users manage own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.budget_categories enable row level security;
drop policy if exists "Users manage own budget categories" on public.budget_categories;
create policy "Users manage own budget categories" on public.budget_categories
  for all using (
    budget_id in (select id from public.budgets where user_id = auth.uid())
  );

create index if not exists idx_budgets_user_id on public.budgets(user_id);
create index if not exists idx_budget_categories_budget_id on public.budget_categories(budget_id);

-- ─── TRIGGER: auto-update updated_at ──────────────────────────────────────────
drop trigger if exists trg_receivables_updated_at on public.receivables;
create trigger trg_receivables_updated_at before update on public.receivables
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at before update on public.budgets
  for each row execute procedure public.set_updated_at();

-- Done. Verify tables exist:
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name in ('receivables', 'receivable_payments', 'budgets', 'budget_categories');