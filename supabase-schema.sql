-- ============================================================
-- Premium Finance — Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── USERS (extends Supabase auth.users) ─────────────────────────────────────
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  full_name     text not null default '',
  avatar_url    text,
  currency      text not null default 'IDR',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete cascade not null,
  name          text not null,
  type          text not null check (type in ('income', 'expense')),
  icon          text,
  color         text,
  created_at    timestamptz not null default now()
);

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references public.profiles(id) on delete cascade not null,
  type              text not null check (type in ('income', 'expense', 'debt_payment', 'transfer')),
  name              text not null,
  description       text,
  category_id       uuid references public.categories(id) on delete set null,
  amount            numeric(15, 2) not null check (amount > 0),
  date              date not null default current_date,
  payment_method    text not null default 'transfer' check (payment_method in ('cash', 'transfer', 'credit_card', 'debit_card', 'e-wallet', 'other')),
  status            text not null default 'completed' check (status in ('completed', 'pending', 'failed')),
  attachment_url    text,
  debt_id           uuid,  -- FK added after debts table
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── DEBTS ────────────────────────────────────────────────────────────────────
create table if not exists public.debts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  name            text not null,
  lender          text not null,
  total_amount    numeric(15, 2) not null check (total_amount > 0),
  total_paid      numeric(15, 2) not null default 0 check (total_paid >= 0),
  remaining       numeric(15, 2) generated always as (total_amount - total_paid) stored,
  start_date      date not null default current_date,
  due_date        date not null,
  priority        text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status          text not null default 'active' check (status in ('active', 'completed', 'overdue')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Add FK from transactions to debts
alter table public.transactions
  add constraint fk_transactions_debt
  foreign key (debt_id) references public.debts(id) on delete set null;

-- ─── DEBT PAYMENTS ───────────────────────────────────────────────────────────
create table if not exists public.debt_payments (
  id              uuid primary key default uuid_generate_v4(),
  debt_id         uuid references public.debts(id) on delete cascade not null,
  transaction_id  uuid references public.transactions(id) on delete set null,
  amount          numeric(15, 2) not null check (amount > 0),
  date            date not null default current_date,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ─── GOALS ────────────────────────────────────────────────────────────────────
create table if not exists public.goals (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  name            text not null,
  target_amount   numeric(15, 2) not null check (target_amount > 0),
  current_amount  numeric(15, 2) not null default 0 check (current_amount >= 0),
  deadline        date not null,
  priority        text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status          text not null default 'active' check (status in ('active', 'completed', 'overdue', 'paused')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── WISHLISTS ────────────────────────────────────────────────────────────────
create table if not exists public.wishlists (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  name            text not null,
  category        text not null default 'Lainnya',
  price           numeric(15, 2) not null check (price > 0),
  saved_amount    numeric(15, 2) not null default 0 check (saved_amount >= 0),
  priority        text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  target_date     date,
  status          text not null default 'pending' check (status in ('pending', 'saved', 'purchased', 'cancelled')),
  notes           text,
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  type            text not null check (type in ('debt_due', 'bill_due', 'goal_reminder', 'wishlist', 'savings', 'system')),
  title           text not null,
  message         text not null,
  is_read         boolean not null default false,
  reference_id    uuid,
  reference_type  text,
  created_at      timestamptz not null default now()
);

-- ─── FINANCIAL SCORES ─────────────────────────────────────────────────────────
create table if not exists public.financial_scores (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references public.profiles(id) on delete cascade not null,
  score               integer not null check (score between 0 and 100),
  grade               text not null check (grade in ('A', 'B', 'C', 'D', 'E')),
  debt_ratio          numeric(5, 2),
  savings_ratio       numeric(5, 2),
  expense_ratio       numeric(5, 2),
  cashflow_stability  numeric(5, 2),
  target_achievement  numeric(5, 2),
  recommendations     text[],
  calculated_at       timestamptz not null default now()
);

-- ─── FORECAST SNAPSHOTS ──────────────────────────────────────────────────────
create table if not exists public.forecast_snapshots (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references public.profiles(id) on delete cascade not null,
  monthly_income      numeric(15, 2) not null,
  fixed_expenses      numeric(15, 2) not null,
  debt_allocation     numeric(15, 2) not null,
  savings_allocation  numeric(15, 2) not null,
  result_json         jsonb not null,
  created_at          timestamptz not null default now()
);

-- ─── PUSH SUBSCRIPTIONS ──────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_own" on public.push_subscriptions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

-- ─── SETTINGS ────────────────────────────────────────────────────────────────
create table if not exists public.settings (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references public.profiles(id) on delete cascade not null unique,
  currency              text not null default 'IDR',
  notif_debt_due        boolean not null default true,
  notif_goal_reminder   boolean not null default true,
  notif_bill_due        boolean not null default false,
  notif_wishlist        boolean not null default false,
  notif_health_report   boolean not null default true,
  theme                 text not null default 'dark',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists idx_transactions_user_id    on public.transactions(user_id);
create index if not exists idx_transactions_date       on public.transactions(date desc);
create index if not exists idx_transactions_type       on public.transactions(type);
create index if not exists idx_debts_user_id           on public.debts(user_id);
create index if not exists idx_debts_status            on public.debts(status);
create index if not exists idx_goals_user_id           on public.goals(user_id);
create index if not exists idx_wishlists_user_id       on public.wishlists(user_id);
create index if not exists idx_notifications_user_id   on public.notifications(user_id, is_read);
create index if not exists idx_financial_scores_user   on public.financial_scores(user_id, calculated_at desc);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.transactions      enable row level security;
alter table public.debts             enable row level security;
alter table public.debt_payments     enable row level security;
alter table public.goals             enable row level security;
alter table public.wishlists         enable row level security;
alter table public.notifications     enable row level security;
alter table public.financial_scores  enable row level security;
alter table public.forecast_snapshots enable row level security;
alter table public.settings          enable row level security;

-- RLS policies: users can only see their own data
do $$
declare
  tbl text;
  col text;
begin
  foreach tbl in array array[
    'categories','transactions','debts','debt_payments',
    'goals','wishlists','notifications','financial_scores',
    'forecast_snapshots','settings'
  ] loop
    col := case when tbl = 'debt_payments' then
      '(select user_id from public.debts where id = debt_id)'
    else 'user_id' end;

    execute format('
      create policy "%s_own" on public.%I
      for all using (auth.uid() = %s)
      with check (auth.uid() = %s);
    ', tbl, tbl, col, col);
  end loop;
end;
$$;

create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ─── TRIGGERS — auto-update updated_at ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare tbl text;
begin
  foreach tbl in array array['profiles','transactions','debts','goals','wishlists','settings'] loop
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I
       for each row execute procedure public.set_updated_at();', tbl, tbl
    );
  end loop;
end;
$$;

-- ─── TRIGGER — auto-create profile on signup ─────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── TRIGGER — sync debt total_paid on payment insert ────────────────────────
create or replace function public.sync_debt_payment()
returns trigger language plpgsql as $$
begin
  update public.debts
  set
    total_paid = (
      select coalesce(sum(amount), 0)
      from public.debt_payments
      where debt_id = new.debt_id
    ),
    status = case
      when (select coalesce(sum(amount), 0) from public.debt_payments where debt_id = new.debt_id) >= total_amount
      then 'completed'
      when due_date < current_date then 'overdue'
      else 'active'
    end
  where id = new.debt_id;
  return new;
end;
$$;

create trigger trg_sync_debt_payment
  after insert or update on public.debt_payments
  for each row execute procedure public.sync_debt_payment();

-- ─── ADDITIONAL FIX: ensure trigger is active ───────────────────────────────
drop trigger if exists trg_sync_debt_payment on public.debt_payments;
create trigger trg_sync_debt_payment
  after insert or update on public.debt_payments
  for each row execute procedure public.sync_debt_payment();

-- ─── SEED: default categories ────────────────────────────────────────────────
-- (Run after user signup via application, or manually replace USER_ID)
-- Example:
-- insert into public.categories (user_id, name, type) values
--   ('USER_UUID', 'Gaji', 'income'),
--   ('USER_UUID', 'Freelance', 'income'),
--   ('USER_UUID', 'Bonus', 'income'),
--   ('USER_UUID', 'Makan', 'expense'),
--   ('USER_UUID', 'Transport', 'expense'),
--   ('USER_UUID', 'Tagihan', 'expense'),
--   ('USER_UUID', 'Keluarga', 'expense'),
--   ('USER_UUID', 'Belanja', 'expense'),
--   ('USER_UUID', 'Kesehatan', 'expense'),
--   ('USER_UUID', 'Hiburan', 'expense'),
--   ('USER_UUID', 'Lainnya', 'expense');
