-- ============================================================
-- Premium Finance — Supabase PostgreSQL Schema (REKONSTRUKSI)
-- Direkonstruksi pada 26 Jun 2026 dari:
--   1. Commit pertama repo (schema asli)
--   2. Export information_schema.columns + pg_constraint dari project
--      Supabase live (ground truth utama)
--   3. Cross-check ke src/types/index.ts & src/lib/db.ts
--
-- AMAN dijalankan di project yang SUDAH ADA datanya:
-- - Semua "create table" pakai "if not exists" -> no-op kalau tabel
--   sudah ada, TIDAK menghapus apapun.
-- - Bagian paling bawah ("FIXES") berisi 1 perbaikan yang WAJIB
--   dijalankan di project existing karena "create table if not exists"
--   tidak akan memperbaiki constraint pada tabel yang sudah ada.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ─── PROFILES (extends Supabase auth.users) ──────────────────────────────────
create table if not exists public.profiles (
  id                        uuid references auth.users(id) on delete cascade primary key,
  full_name                 text not null default '',
  avatar_url                text,
  currency                  text not null default 'IDR',
  -- Preferensi notifikasi disimpan sebagai JSONB tunggal (bukan kolom boolean
  -- terpisah seperti rancangan awal di tabel `settings`). Shape default-nya
  -- mengikuti DEFAULT_NOTIF_PREFS di src/lib/db.ts.
  notification_preferences  jsonb not null default '{
    "debt_due": true,
    "goal_reminder": true,
    "recurring_bill": false,
    "wishlist_update": false,
    "health_score_weekly": true
  }'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
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

-- ─── ACCOUNTS (Sumber Dana) ───────────────────────────────────────────────────
create table if not exists public.accounts (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references public.profiles(id) on delete cascade not null,
  name              text not null,
  type              text not null check (type in ('bank', 'ewallet', 'cash', 'other')),
  initial_balance   numeric(15, 2) not null default 0,
  color             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── DEBTS ────────────────────────────────────────────────────────────────────
create table if not exists public.debts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references public.profiles(id) on delete cascade not null,
  name                text not null,
  lender              text not null,
  total_amount        numeric(15, 2) not null check (total_amount > 0),
  total_paid          numeric(15, 2) not null default 0 check (total_paid >= 0),
  remaining           numeric(15, 2) generated always as (total_amount - total_paid) stored,
  start_date          date not null default current_date,
  due_date            date not null,
  priority            text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status              text not null default 'active' check (status in ('active', 'completed', 'overdue')),
  notes               text,
  -- Cicilan tetap (ditambahkan belakangan untuk fitur installment)
  is_installment      boolean not null default false,
  installment_amount  numeric(15, 2),
  tenor_months        integer,
  installments_paid   integer,
  next_due_date       date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── RECURRING TRANSACTIONS ───────────────────────────────────────────────────
create table if not exists public.recurring_transactions (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references public.profiles(id) on delete cascade not null,
  name                  text not null,
  type                  text not null check (type in ('income', 'expense')),
  amount                numeric(15, 2) not null check (amount > 0),
  category_id           uuid references public.categories(id) on delete set null,
  payment_method        text not null default 'transfer' check (payment_method in ('cash', 'transfer', 'credit_card', 'debit_card', 'e-wallet', 'other')),
  frequency             text not null check (frequency in ('monthly', 'weekly')),
  day_of_period         integer not null check (day_of_period between 0 and 31),
  start_date            date not null default current_date,
  end_date              date,
  is_active             boolean not null default true,
  last_generated_date   date,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references public.profiles(id) on delete cascade not null,
  -- PENTING: 'saving' wajib ada di sini. Lihat catatan FIXES di paling bawah.
  -- 'receivable_out' = piutang keluar (uang dipinjamkan). Diperlakukan kayak
  -- 'debt_payment': ngurangin saldo akun & kehitung cash-out bulanan, tapi
  -- gak ikut breakdown kategori pengeluaran.
  type              text not null check (type in ('income', 'expense', 'debt_payment', 'transfer', 'saving', 'receivable_out')),
  name              text not null,
  description       text,
  category_id       uuid references public.categories(id) on delete set null,
  amount            numeric(15, 2) not null check (amount > 0),
  date              date not null default current_date,
  payment_method    text not null default 'transfer' check (payment_method in ('cash', 'transfer', 'credit_card', 'debit_card', 'e-wallet', 'other')),
  status            text not null default 'completed' check (status in ('completed', 'pending', 'failed')),
  attachment_url    text,
  debt_id           uuid references public.debts(id) on delete set null,
  account_id        uuid references public.accounts(id) on delete set null,
  to_account_id     uuid references public.accounts(id) on delete set null,
  recurring_id      uuid references public.recurring_transactions(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── DEBT PAYMENTS ────────────────────────────────────────────────────────────
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

-- ─── PUSH SUBSCRIPTIONS ───────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now()
);

-- ─── SETTINGS (LEGACY — sudah TIDAK dipakai kode saat ini) ───────────────────
-- Disimpan di sini cuma supaya schema match sama database live. Aplikasi
-- sekarang pakai kolom profiles.notification_preferences di atas, bukan
-- tabel ini. Aman untuk di-drop kalau mau bersih-bersih (lihat catatan
-- di akhir chat).
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
  -- Akun sumber dana waktu piutang dibuat + link ke transaksi
  -- "receivable_out" yang otomatis kebuat (lihat addReceivable di db.ts).
  account_id      uuid references public.accounts(id) on delete set null,
  transaction_id  uuid references public.transactions(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.receivable_payments (
  id              uuid primary key default uuid_generate_v4(),
  receivable_id   uuid references public.receivables(id) on delete cascade not null,
  amount          numeric(15, 2) not null check (amount > 0),
  date            date not null default current_date,
  notes           text,
  -- Akun tujuan tiap pembayaran + link ke transaksi "income" otomatisnya.
  account_id      uuid references public.accounts(id) on delete set null,
  transaction_id  uuid references public.transactions(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ─── BUDGETS ──────────────────────────────────────────────────────────────────
create table if not exists public.budgets (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid references public.profiles(id) on delete cascade not null,
  name                    text not null,
  period                  text not null check (period in ('monthly', 'weekly')),
  year                    integer not null,
  month                   integer check (month between 1 and 12),
  week                    integer check (week between 1 and 53),
  -- Rentang tanggal eksplisit buat budget mingguan (bukan minggu kalender
  -- yang dihitung dari day-of-month/7). Ini sumber utama buat filter
  -- transaksi kalau period = 'weekly'.
  start_date              date,
  end_date                date,
  total_income            numeric(15, 2) not null default 0,
  total_planned           numeric(15, 2) not null default 0,
  total_actual            numeric(15, 2) not null default 0,
  notes                   text,
  -- Integrasi budget mingguan <-> bulanan
  parent_budget_id        uuid references public.budgets(id) on delete set null,
  weekly_source_category  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists public.budget_categories (
  id                    uuid primary key default uuid_generate_v4(),
  budget_id             uuid references public.budgets(id) on delete cascade not null,
  name                  text not null,
  planned_amount        numeric(15, 2) not null default 0,
  actual_amount         numeric(15, 2) not null default 0,
  color                 text default '#64748B',
  -- Auto-sync dari transaksi (syncBudgetActual di src/lib/db.ts)
  mapped_category_ids   uuid[],
  keyword_filter        text,
  -- Kalau kategori ini punya "induk" di budget bulanan (dipilih pas bikin
  -- budget mingguan), mapping di atas disalin dari sini biar gak perlu
  -- input ulang manual di form. Dipakai juga buat cek konsistensi/refresh.
  parent_budget_category_id uuid references public.budget_categories(id) on delete set null,
  created_at            timestamptz not null default now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
create index if not exists idx_transactions_user_id     on public.transactions(user_id);
create index if not exists idx_transactions_date        on public.transactions(date desc);
create index if not exists idx_transactions_type        on public.transactions(type);
create index if not exists idx_transactions_account_id  on public.transactions(account_id);
create index if not exists idx_debts_user_id            on public.debts(user_id);
create index if not exists idx_debts_status             on public.debts(status);
create index if not exists idx_goals_user_id            on public.goals(user_id);
create index if not exists idx_wishlists_user_id        on public.wishlists(user_id);
create index if not exists idx_notifications_user_id    on public.notifications(user_id, is_read);
create index if not exists idx_financial_scores_user    on public.financial_scores(user_id, calculated_at desc);
create index if not exists idx_accounts_user_id         on public.accounts(user_id);
create index if not exists idx_recurring_user_id        on public.recurring_transactions(user_id);
create index if not exists idx_receivables_user_id      on public.receivables(user_id);
create index if not exists idx_receivables_status       on public.receivables(status);
create index if not exists idx_receivables_account_id   on public.receivables(account_id);
create index if not exists idx_receivable_payments_account_id on public.receivable_payments(account_id);
create index if not exists idx_budgets_user_id          on public.budgets(user_id);
create index if not exists idx_budget_categories_budget_id on public.budget_categories(budget_id);
create index if not exists idx_push_subscriptions_user  on public.push_subscriptions(user_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table public.profiles              enable row level security;
alter table public.categories             enable row level security;
alter table public.accounts               enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.transactions           enable row level security;
alter table public.debts                  enable row level security;
alter table public.debt_payments          enable row level security;
alter table public.goals                  enable row level security;
alter table public.wishlists              enable row level security;
alter table public.notifications          enable row level security;
alter table public.financial_scores       enable row level security;
alter table public.forecast_snapshots     enable row level security;
alter table public.push_subscriptions     enable row level security;
alter table public.settings               enable row level security;
alter table public.receivables            enable row level security;
alter table public.receivable_payments    enable row level security;
alter table public.budgets                enable row level security;
alter table public.budget_categories      enable row level security;

drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Tabel dengan kolom user_id langsung -> 1 baris policy generik per tabel
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'categories','accounts','recurring_transactions','transactions','debts',
    'goals','wishlists','notifications','financial_scores',
    'forecast_snapshots','push_subscriptions','settings',
    'receivables','budgets'
  ] loop
    execute format('drop policy if exists "%s_own" on public.%I;', tbl, tbl);
    execute format('
      create policy "%s_own" on public.%I
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
    ', tbl, tbl);
  end loop;
end;
$$;

-- Tabel anak (akses lewat parent) -> policy manual
drop policy if exists "debt_payments_own" on public.debt_payments;
create policy "debt_payments_own" on public.debt_payments
  for all using (
    debt_id in (select id from public.debts where user_id = auth.uid())
  );

drop policy if exists "receivable_payments_own" on public.receivable_payments;
create policy "receivable_payments_own" on public.receivable_payments
  for all using (
    receivable_id in (select id from public.receivables where user_id = auth.uid())
  );

drop policy if exists "budget_categories_own" on public.budget_categories;
create policy "budget_categories_own" on public.budget_categories
  for all using (
    budget_id in (select id from public.budgets where user_id = auth.uid())
  );

-- ─── TRIGGERS — auto-update updated_at ────────────────────────────────────────
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
  foreach tbl in array array[
    'profiles','transactions','debts','goals','wishlists','settings',
    'accounts','recurring_transactions','budgets','receivables'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I;', tbl, tbl);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I
       for each row execute procedure public.set_updated_at();', tbl, tbl
    );
  end loop;
end;
$$;

-- ─── TRIGGER — auto-create profile (+ legacy settings row) on signup ─────────
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── TRIGGER — sync debt total_paid & status saat debt_payments berubah ─────
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

drop trigger if exists trg_sync_debt_payment on public.debt_payments;
create trigger trg_sync_debt_payment
  after insert or update on public.debt_payments
  for each row execute procedure public.sync_debt_payment();


-- ============================================================
-- FIXES — WAJIB dijalankan walaupun project Supabase kamu sudah
-- ada & sudah jalan. "create table if not exists" di atas TIDAK
-- akan menyentuh tabel yang sudah ada, jadi bug di bawah ini
-- masih nempel di database live kamu sampai kamu jalanin ini.
-- ============================================================

-- FIX #1 (PALING PENTING): constraint transactions_type_check di
-- database live kamu MASIH versi lama — cuma izinin
-- ('income','expense','debt_payment','transfer'), TANPA 'saving'.
-- Tapi kode (TransactionFormModal, goals/wishlist allocation,
-- SavingsOverview) udah aktif insert transaksi type='saving'.
-- Akibatnya: setiap kali user nyimpen transaksi tabungan / alokasi
-- ke goal & wishlist, insert-nya bakal GAGAL kena
-- "violates check constraint transactions_type_check".
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('income', 'expense', 'debt_payment', 'transfer', 'saving'));

  -- ============================================================
-- FIX: Atomicity untuk addTransaction (insert transaction +
-- debt_payment + sync budget) jadi SATU operasi atomic di DB,
-- bukan beberapa request berurutan dari sisi JS.
--
-- Aman dijalankan di project yang sudah ada (cuma nambah 2 fungsi
-- baru, tidak mengubah/menghapus tabel atau data manapun).
-- ============================================================

-- ─── Helper: sync budget actual (port 1:1 dari syncBudgetActual di db.ts) ────
create or replace function public.sync_budget_actual(
  p_user_id        uuid,
  p_amount         numeric,
  p_date           date,
  p_override_budget_id uuid,
  p_category_id    uuid,
  p_category_name  text,
  p_tx_name        text
) returns void
language plpgsql
security invoker
as $$
declare
  v_year   integer := extract(year from p_date);
  v_month  integer := extract(month from p_date);
  v_week   integer := ceil(extract(day from p_date) / 7.0);
  v_budget_ids uuid[];
  v_budget     record;
  v_matched_id uuid;
begin
  if p_override_budget_id is not null then
    -- Budget yang dipilih user secara eksplisit + parent-nya (kalau weekly)
    select array_agg(id) into v_budget_ids
    from public.budgets
    where user_id = p_user_id
      and (id = p_override_budget_id
           or id = (select parent_budget_id from public.budgets
                     where id = p_override_budget_id and user_id = p_user_id));
  else
    -- Semua budget (monthly + weekly) yang cover tanggal transaksi,
    -- plus parent dari weekly manapun yang belum termasuk
    select array_agg(id) into v_budget_ids
    from (
      select id from public.budgets
      where user_id = p_user_id and year = v_year
        and (
          (period = 'monthly' and month = v_month)
          or (period = 'weekly' and month = v_month and week = v_week)
        )
      union
      select b.parent_budget_id from public.budgets b
      where b.user_id = p_user_id and b.year = v_year
        and b.period = 'weekly' and b.month = v_month and b.week = v_week
        and b.parent_budget_id is not null
    ) ids;
  end if;

  if v_budget_ids is null or array_length(v_budget_ids, 1) is null then
    return;
  end if;

  for v_budget in
    select * from public.budgets where id = any(v_budget_ids)
  loop
    v_matched_id := null;

    -- Prioritas 1 & 2: mapped_category_ids cocok (+ keyword_filter kalau ada)
    if p_category_id is not null then
      select id into v_matched_id
      from public.budget_categories
      where budget_id = v_budget.id
        and mapped_category_ids @> array[p_category_id]
        and (
          keyword_filter is null
          or p_tx_name is null
          or position(lower(keyword_filter) in lower(p_tx_name)) > 0
        )
      order by created_at
      limit 1;
    end if;

    -- Prioritas 3: keyword_filter cocok di nama transaksi (debt_payment/saving tanpa kategori)
    if v_matched_id is null and p_tx_name is not null then
      select id into v_matched_id
      from public.budget_categories
      where budget_id = v_budget.id
        and keyword_filter is not null
        and position(lower(keyword_filter) in lower(p_tx_name)) > 0
      order by created_at
      limit 1;
    end if;

    -- Prioritas 4: fallback name-matching lama
    if v_matched_id is null and p_category_name is not null and p_category_name <> '' then
      select id into v_matched_id
      from public.budget_categories
      where budget_id = v_budget.id
        and lower(name) = lower(p_category_name)
      order by created_at
      limit 1;
    end if;

    if v_matched_id is not null then
      -- Atomic increment (bukan read-then-write seperti versi JS lama)
      update public.budget_categories
      set actual_amount = actual_amount + p_amount
      where id = v_matched_id;

      update public.budgets
      set total_actual = (
        select coalesce(sum(actual_amount), 0)
        from public.budget_categories
        where budget_id = v_budget.id
      )
      where id = v_budget.id;
    end if;
  end loop;
end;
$$;

-- ─── Main: insert transaction + debt_payment + budget sync, 1 transaction ───
create or replace function public.add_transaction_with_effects(
  p_type            text,
  p_name            text,
  p_amount          numeric,
  p_date            date,
  p_description     text default null,
  p_category_id     uuid default null,
  p_payment_method  text default 'transfer',
  p_status          text default 'completed',
  p_attachment_url  text default null,
  p_debt_id         uuid default null,
  p_account_id      uuid default null,
  p_to_account_id   uuid default null,
  p_recurring_id    uuid default null,
  p_notes           text default null,
  p_override_budget_id uuid default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id     uuid := auth.uid();
  v_tx          public.transactions;
  v_category_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.transactions (
    user_id, type, name, description, category_id, amount, date,
    payment_method, status, attachment_url, debt_id, account_id,
    to_account_id, recurring_id, notes
  ) values (
    v_user_id, p_type, p_name, p_description, p_category_id, p_amount, p_date,
    p_payment_method, p_status, p_attachment_url, p_debt_id, p_account_id,
    p_to_account_id, p_recurring_id, p_notes
  )
  returning * into v_tx;

  if p_type = 'debt_payment' and p_debt_id is not null then
    insert into public.debt_payments (debt_id, transaction_id, amount, date)
    values (p_debt_id, v_tx.id, p_amount, p_date);
    -- trigger trg_sync_debt_payment otomatis update debts.total_paid & status
  end if;

  if p_type in ('expense', 'debt_payment', 'saving') then
    select name into v_category_name from public.categories where id = p_category_id;

    perform public.sync_budget_actual(
      v_user_id, p_amount, p_date, p_override_budget_id,
      p_category_id, coalesce(v_category_name, ''), p_name
    );
  end if;

  -- Kembalikan transaksi + kategori (biar konsisten sama bentuk return lama)
  return jsonb_build_object(
    'id', v_tx.id, 'user_id', v_tx.user_id, 'type', v_tx.type, 'name', v_tx.name,
    'description', v_tx.description, 'category_id', v_tx.category_id,
    'amount', v_tx.amount, 'date', v_tx.date, 'payment_method', v_tx.payment_method,
    'status', v_tx.status, 'attachment_url', v_tx.attachment_url, 'debt_id', v_tx.debt_id,
    'account_id', v_tx.account_id, 'to_account_id', v_tx.to_account_id,
    'recurring_id', v_tx.recurring_id, 'notes', v_tx.notes,
    'created_at', v_tx.created_at, 'updated_at', v_tx.updated_at,
    'category', (select to_jsonb(c) from public.categories c where c.id = v_tx.category_id)
  );
end;
$$;