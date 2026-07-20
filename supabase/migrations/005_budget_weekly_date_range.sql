-- ─── Migration: Budget mingguan pakai rentang tanggal eksplisit ─────────────
-- Jalankan sekali di Supabase SQL Editor (project lo yang sudah live).
-- Idempotent — aman dijalankan berkali-kali.
--
-- Latar belakang: sebelumnya "minggu ke-N" dihitung dari
-- Math.ceil(hari_di_bulan / 7), yang gak match sama minggu kalender beneran
-- dan bikin bingung pas tanggal 1 bulan jatuh di tengah minggu. Selain itu,
-- tiap budget mingguan harus define ulang mapped_category_ids/keyword_filter
-- sendiri walau kategorinya sama persis kayak budget bulanan induknya —
-- gampang typo/drift dan bikin dua sumber kebenaran.
--
-- Migration ini:
-- 1) Nambah start_date/end_date eksplisit di budgets (dipakai kalau period
--    weekly) — gak gantiin kolom `week` biar backward compatible, tapi jadi
--    sumber utama buat filter transaksi kalau kolomnya keisi.
-- 2) Nambah parent_budget_category_id di budget_categories — kategori
--    mingguan tinggal nge-link ke kategori bulanan induknya, mapping
--    (mapped_category_ids/keyword_filter) tetap disalin biar query gampang,
--    tapi UI form gak lagi minta user isi manual dari nol.
-- 3) Backfill start_date/end_date buat row weekly yang udah ada, dari
--    logic day/7 yang lama, biar data existing gak ilang konteksnya.

alter table public.budgets
  add column if not exists start_date date,
  add column if not exists end_date   date;

alter table public.budget_categories
  add column if not exists parent_budget_category_id uuid
    references public.budget_categories(id) on delete set null;

-- Backfill start_date/end_date untuk row weekly lama (satu kali, aman
-- diulang karena cuma ngisi yang masih null).
update public.budgets b
set
  start_date = make_date(b.year, coalesce(b.month, 1), 1) + ((b.week - 1) * 7),
  end_date = least(
    make_date(b.year, coalesce(b.month, 1), 1) + (b.week * 7) - 1,
    (make_date(b.year, coalesce(b.month, 1), 1) + interval '1 month - 1 day')::date
  )
where b.period = 'weekly'
  and b.week is not null
  and b.start_date is null;

create index if not exists idx_budgets_start_end_date on public.budgets(start_date, end_date);
