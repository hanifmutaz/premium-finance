-- ─── FIX: installments_paid & next_due_date gak pernah direcalculate ────────
-- Dua kolom ini cuma diisi SEKALI pas debt dibuat (installments_paid=0,
-- next_due_date=due_date) — gak ada trigger/fungsi manapun yang update lagi
-- pas ada pembayaran cicilan masuk/dihapus/diedit. Akibatnya UI "Cicilan
-- ke-N/tenor" dan "Cicilan berikutnya: <tanggal>" di halaman Debts & di
-- DebtPaymentModal nyangkut di nilai awal terus walau debt_payments-nya
-- udah nambah.
--
-- Fix: extend trigger sync_debt_payment (migration 009) supaya, khusus
-- debt dengan is_installment = true, ikut recalculate:
--   - installments_paid = jumlah baris debt_payments buat debt itu
--   - next_due_date     = due_date + installments_paid bulan
create or replace function public.sync_debt_payment()
returns trigger language plpgsql as $$
declare
  v_debt_id     uuid := coalesce(new.debt_id, old.debt_id);
  v_old_debt_id uuid := old.debt_id;
begin
  if v_debt_id is not null then
    update public.debts
    set
      total_paid = (
        select coalesce(sum(amount), 0)
        from public.debt_payments
        where debt_id = v_debt_id
      ),
      status = case
        when (select coalesce(sum(amount), 0) from public.debt_payments where debt_id = v_debt_id) >= total_amount
        then 'completed'
        when due_date < current_date then 'overdue'
        else 'active'
      end,
      installments_paid = case
        when is_installment
        then (select count(*) from public.debt_payments where debt_id = v_debt_id)
        else installments_paid
      end,
      next_due_date = case
        when is_installment
        then (due_date + (make_interval(months => (select count(*)::int from public.debt_payments where debt_id = v_debt_id))))::date
        else next_due_date
      end
    where id = v_debt_id;
  end if;

  -- UPDATE yang mindahin payment ke debt lain — debt LAMA juga direcalculate.
  if tg_op = 'UPDATE' and v_old_debt_id is distinct from new.debt_id and v_old_debt_id is not null then
    update public.debts
    set
      total_paid = (
        select coalesce(sum(amount), 0) from public.debt_payments where debt_id = v_old_debt_id
      ),
      status = case
        when (select coalesce(sum(amount), 0) from public.debt_payments where debt_id = v_old_debt_id) >= total_amount
        then 'completed'
        when due_date < current_date then 'overdue'
        else 'active'
      end,
      installments_paid = case
        when is_installment
        then (select count(*) from public.debt_payments where debt_id = v_old_debt_id)
        else installments_paid
      end,
      next_due_date = case
        when is_installment
        then (due_date + (make_interval(months => (select count(*)::int from public.debt_payments where debt_id = v_old_debt_id))))::date
        else next_due_date
      end
    where id = v_old_debt_id;
  end if;

  return coalesce(new, old);
end;
$$;

-- Trigger-nya sendiri (nama, event, timing) gak berubah dari migration 009,
-- cuma droprecreate lagi biar pasti nempel ke definisi function terbaru.
drop trigger if exists trg_sync_debt_payment on public.debt_payments;
create trigger trg_sync_debt_payment
  after insert or update or delete on public.debt_payments
  for each row execute procedure public.sync_debt_payment();

-- ─── Backfill satu kali ──────────────────────────────────────────────────────
-- Debt cicilan yang udah ada & udah punya histori debt_payments dari sebelum
-- fix ini bakal punya installments_paid/next_due_date yang stale. Samain ke
-- kondisi seharusnya sekarang juga (aman dijalankan berkali-kali / idempotent).
update public.debts d
set
  installments_paid = coalesce(dp.cnt, 0),
  next_due_date = (d.due_date + make_interval(months => coalesce(dp.cnt, 0)::int))::date
from (
  select debt_id, count(*) as cnt
  from public.debt_payments
  group by debt_id
) dp
where d.id = dp.debt_id
  and d.is_installment = true;