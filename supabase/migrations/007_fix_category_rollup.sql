-- ─── Migration 007: fix rollup ke kategori bulanan spesifik ─────────────────
-- Bug di apply_budget_category_effect (migration 006): rollup ke budget
-- bulanan cuma recompute total_actual BUDGET-nya doang, gak pernah nyentuh
-- actual_amount KATEGORI bulanan spesifik (mis. "Minggu 1", "Minggu 2") yang
-- jadi induk dari kategori mingguan. Akibatnya breakdown per-kategori di
-- bulanan gak ke-update — kadang malah ke-overwrite balik ke nilai lama
-- kalau ada transaksi lain yang nyentuh budget bulanan itu juga (total
-- dihitung dari kategori yang stale).
--
-- Jalankan sekali di Supabase SQL Editor. Idempotent.

create or replace function public.apply_budget_category_effect(
  p_budget_category_id uuid,
  p_amount              numeric
) returns void
language plpgsql
security invoker
as $$
declare
  v_budget_id                 uuid;
  v_parent_budget_category_id uuid;
  v_parent_budget_id          uuid;
begin
  if p_budget_category_id is null then
    return;
  end if;

  update public.budget_categories
  set actual_amount = actual_amount + p_amount
  where id = p_budget_category_id
  returning budget_id, parent_budget_category_id
    into v_budget_id, v_parent_budget_category_id;

  if v_budget_id is null then
    return; -- kategori/budget-nya udah gak ada (mungkin kehapus)
  end if;

  update public.budgets
  set total_actual = (
    select coalesce(sum(actual_amount), 0)
    from public.budget_categories where budget_id = v_budget_id
  )
  where id = v_budget_id;

  -- Rollup ke KATEGORI BULANAN spesifik yang jadi induknya (mis. "Kopi" di
  -- minggu 1 → "Minggu 1" di budget bulanan) — recompute dari SUM semua
  -- kategori mingguan yang nunjuk ke induk yang sama, BUKAN cuma recompute
  -- total budget doang.
  if v_parent_budget_category_id is not null then
    update public.budget_categories
    set actual_amount = (
      select coalesce(sum(actual_amount), 0)
      from public.budget_categories
      where parent_budget_category_id = v_parent_budget_category_id
    )
    where id = v_parent_budget_category_id
    returning budget_id into v_parent_budget_id;

    if v_parent_budget_id is not null then
      update public.budgets
      set total_actual = (
        select coalesce(sum(actual_amount), 0)
        from public.budget_categories where budget_id = v_parent_budget_id
      )
      where id = v_parent_budget_id;
    end if;
  end if;
end;
$$;
