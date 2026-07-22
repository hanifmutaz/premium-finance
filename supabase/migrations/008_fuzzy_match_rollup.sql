-- ─── Fix: sync_budget_actual (jalur fuzzy-match) gak pernah rollup ke induk ──
-- Migration 007 udah benerin rollup buat jalur EKSPLISIT (lewat
-- apply_budget_category_effect), tapi sync_budget_actual (jalur fuzzy-match
-- by nama kategori / keyword) masih update actual_amount + total_actual
-- budget-nya sendiri doang, gak pernah nyentuh parent_budget_category_id.
-- Akibatnya: transaksi yang match ke kategori mingguan yang PUNYA induk
-- bulanan (mis. "Roko" di minggu 1 → rollup ke kategori bulanan) gak pernah
-- keupdate di level bulanan kalau lewat fuzzy-match, cuma kalau lewat
-- assignment eksplisit.
--
-- Fix-nya: begitu sync_budget_actual nemu v_matched_id, dia gak lagi nulis
-- update sendiri — tinggal delegasiin ke apply_budget_category_effect, yang
-- udah nangenin rollup ke induk. Biar cuma ada SATU tempat yang tau cara
-- "nambah actual_amount + rollup", gak dobel logic yang bisa drift lagi di
-- masa depan.

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
    select array_agg(id) into v_budget_ids
    from public.budgets
    where user_id = p_user_id
      and (id = p_override_budget_id
           or id = (select parent_budget_id from public.budgets
                     where id = p_override_budget_id and user_id = p_user_id));
  else
    select array_agg(id) into v_budget_ids
    from (
      select id from public.budgets
      where user_id = p_user_id and year = v_year
        and (
          (period = 'monthly' and month = v_month)
          or (
            period = 'weekly' and (
              (start_date is not null and end_date is not null
               and p_date between start_date and end_date)
              or (start_date is null and month = v_month and week = v_week)
            )
          )
        )
      union
      select b.parent_budget_id from public.budgets b
      where b.user_id = p_user_id and b.year = v_year and b.period = 'weekly'
        and (
          (b.start_date is not null and b.end_date is not null
           and p_date between b.start_date and b.end_date)
          or (b.start_date is null and b.month = v_month and b.week = v_week)
        )
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

    if v_matched_id is null and p_tx_name is not null then
      select id into v_matched_id
      from public.budget_categories
      where budget_id = v_budget.id
        and keyword_filter is not null
        and position(lower(keyword_filter) in lower(p_tx_name)) > 0
      order by created_at
      limit 1;
    end if;

    if v_matched_id is null and p_category_name is not null and p_category_name <> '' then
      select id into v_matched_id
      from public.budget_categories
      where budget_id = v_budget.id
        and lower(name) = lower(p_category_name)
      order by created_at
      limit 1;
    end if;

    if v_matched_id is not null then
      -- Dulu: update actual_amount + total_actual manual di sini (gak pernah
      -- rollup ke induk). Sekarang: delegasiin ke apply_budget_category_effect
      -- biar rollup ke kategori bulanan induk (kalau ada) ikut kepanggil juga.
      perform public.apply_budget_category_effect(v_matched_id, p_amount);
    end if;
  end loop;
end;
$$;
