-- ─── FIX: sync_debt_payment gak pernah jalan pas DELETE ─────────────────────
-- Trigger lama: "after insert or update" doang. Padahal deleteTransaction()
-- di kode (src/lib/db.ts) menghapus row debt_payments pas transaksi
-- debt_payment dihapus, dan komentarnya KLAIM "trigger akan otomatis
-- recalculate total_paid/status" — klaim itu salah, karena trigger-nya gak
-- pernah nyala buat event delete. Akibatnya: hapus transaksi cicilan bikin
-- debt_payments row-nya hilang, tapi debts.total_paid/status tetap kepake
-- angka lama (gak pernah balik turun).
--
-- Sekalian dibenerin: kalau debt_id sebuah debt_payments row DIUBAH (lewat
-- update), fungsi lama cuma recalculate debt yang BARU (new.debt_id) — debt
-- LAMA (old.debt_id) gak ikut direcalculate, jadi nyangkut nilai yang udah
-- gak valid.
create or replace function public.sync_debt_payment()
returns trigger language plpgsql as $$
declare
  v_debt_id uuid := coalesce(new.debt_id, old.debt_id);
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
      end
    where id = v_debt_id;
  end if;

  -- UPDATE yang mindahin payment ke debt lain — debt LAMA juga harus
  -- direcalculate (tanpa ini dia nyangkut nilai lama selamanya).
  if tg_op = 'UPDATE' and old.debt_id is distinct from new.debt_id and old.debt_id is not null then
    update public.debts
    set
      total_paid = (
        select coalesce(sum(amount), 0) from public.debt_payments where debt_id = old.debt_id
      ),
      status = case
        when (select coalesce(sum(amount), 0) from public.debt_payments where debt_id = old.debt_id) >= total_amount
        then 'completed'
        when due_date < current_date then 'overdue'
        else 'active'
      end
    where id = old.debt_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_debt_payment on public.debt_payments;
create trigger trg_sync_debt_payment
  after insert or update or delete on public.debt_payments
  for each row execute procedure public.sync_debt_payment();