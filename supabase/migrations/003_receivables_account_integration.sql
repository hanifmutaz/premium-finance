-- ─── Migration: Integrasi Piutang (Receivables) ke Akun ─────────────────────
-- Jalankan sekali di Supabase SQL Editor (project lo yang sudah live).
-- Idempotent — aman dijalankan berkali-kali.

-- 1) Izinkan tipe transaksi baru "receivable_out" (piutang keluar / uang
--    yang dipinjamkan). Perlakuannya sama seperti "debt_payment": ngurangin
--    saldo akun & kehitung sebagai cash-out bulanan, tapi TIDAK ikut
--    breakdown kategori pengeluaran (yang cuma nyaring type = 'expense').
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('income', 'expense', 'debt_payment', 'transfer', 'saving', 'receivable_out'));

-- 2) Kolom akun sumber dana + link ke transaksi disbursement, di tabel
--    receivables (piutang keluar dicatat sekali waktu piutang dibuat).
alter table public.receivables
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

-- 3) Kolom akun tujuan + link ke transaksi income, di tabel
--    receivable_payments (tiap pembayaran piutang bisa masuk ke akun beda).
alter table public.receivable_payments
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

create index if not exists idx_receivables_account_id on public.receivables(account_id);
create index if not exists idx_receivable_payments_account_id on public.receivable_payments(account_id);
