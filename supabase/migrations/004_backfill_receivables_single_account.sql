-- ─── Backfill: Piutang & Pembayaran Lama → 1 Akun ────────────────────────────
-- Jalankan SETELAH 003_receivables_account_integration.sql.
-- Idempotent — cuma nyentuh record yang account_id-nya masih NULL, jadi aman
-- dijalankan berkali-kali (yang udah kebackfill gak bakal keduplikat).
--
-- PENTING: ganti 'NAMA_AKUN_LO' di bawah sesuai nama akun tujuan PERSIS
-- (case-sensitive) — cek nama akun lo di halaman Akun kalau lupa persisnya.
--
-- EFEK: script ini bikin transaksi baru buat tiap piutang/pembayaran lama,
-- jadi saldo akun yang lo pilih bakal berubah (biasanya turun, karena piutang
-- keluar yang dulu gak ke-catat sekarang baru ngurangin saldo). Ini normal —
-- itu emang koreksi ke kondisi saldo yang seharusnya dari awal.

do $$
declare
  r record;
  v_tx_id uuid;
  v_account_name text := 'NAMA_AKUN_LO'; -- <-- GANTI INI
  v_account_id uuid;
begin
  -- 1) Backfill piutang keluar (receivables tanpa account_id)
  for r in
    select * from public.receivables where account_id is null
  loop
    select id into v_account_id from public.accounts
      where user_id = r.user_id and name = v_account_name limit 1;

    if v_account_id is null then
      raise notice 'Akun "%" gak ketemu buat user %, skip receivable % (%)', v_account_name, r.user_id, r.id, r.name;
      continue;
    end if;

    insert into public.transactions (
      user_id, type, name, description, amount, date,
      payment_method, status, account_id
    ) values (
      r.user_id, 'receivable_out', 'Piutang: ' || r.name, 'Dipinjamkan ke ' || r.borrower,
      r.total_amount, r.start_date, 'transfer', 'completed', v_account_id
    ) returning id into v_tx_id;

    update public.receivables set account_id = v_account_id, transaction_id = v_tx_id where id = r.id;
  end loop;

  -- 2) Backfill piutang masuk (receivable_payments tanpa account_id)
  for r in
    select rp.*, rv.user_id as owner_id, rv.name as receivable_name, rv.borrower
    from public.receivable_payments rp
    join public.receivables rv on rv.id = rp.receivable_id
    where rp.account_id is null
  loop
    select id into v_account_id from public.accounts
      where user_id = r.owner_id and name = v_account_name limit 1;

    if v_account_id is null then
      raise notice 'Akun "%" gak ketemu buat user %, skip payment %', v_account_name, r.owner_id, r.id;
      continue;
    end if;

    insert into public.transactions (
      user_id, type, name, description, amount, date,
      payment_method, status, account_id
    ) values (
      r.owner_id, 'income', 'Piutang Diterima: ' || r.receivable_name,
      coalesce(r.notes, 'Pembayaran piutang dari ' || r.borrower),
      r.amount, r.date, 'transfer', 'completed', v_account_id
    ) returning id into v_tx_id;

    update public.receivable_payments set account_id = v_account_id, transaction_id = v_tx_id where id = r.id;
  end loop;
end $$;

-- Cek hasil:
-- select id, name, account_id, transaction_id from public.receivables;
-- select id, amount, account_id, transaction_id from public.receivable_payments;
