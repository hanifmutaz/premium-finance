-- ─── Migration: Assign transaksi ke budget_category secara eksplisit ────────
-- Jalankan sekali di Supabase SQL Editor (project yang sudah live).
-- Idempotent — aman dijalankan berkali-kali.
--
-- Latar belakang: sync_budget_actual (fuzzy-matching lewat mapped_category_ids
-- /keyword_filter/nama) tetap dipakai buat transaksi lama & transaksi yang
-- gak di-assign manual. Tapi user sekarang bisa pilih LANGSUNG mau masuk ke
-- kategori budget mana pas input transaksi (kayak "Minggu 1 > Kopi") — itu
-- disimpan di transactions.budget_category_id, gak ada ambiguitas matching
-- sama sekali buat transaksi yang dipilih eksplisit.
--
-- Dua jalur hidup berdampingan:
--   - budget_category_id NOT NULL → efeknya langsung, atomic increment ke
--     kategori itu (dan rollup ke budget induk kalau ada).
--   - budget_category_id NULL     → tetap lewat sync_budget_actual (fuzzy),
--     behavior lama gak berubah.

alter table public.transactions
  add column if not exists budget_category_id uuid
    references public.budget_categories(id) on delete set null;

create index if not exists idx_transactions_budget_category_id
  on public.transactions(budget_category_id);

-- ─── sync_budget_actual: ikut pakai start_date/end_date kalau ada ───────────
-- (celah dari migration 005 — start_date/end_date udah ada di kolom & dipakai
-- di sisi JS buat baca, tapi fungsi ini masih murni week=ceil(day/7) doang.
-- Disatuin sekarang biar gak ada 2 sumber kebenaran soal "budget mingguan ini
-- nyakup tanggal apa aja".)
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
              -- Row baru: start_date/end_date eksplisit adalah sumber utama
              (start_date is not null and end_date is not null
               and p_date between start_date and end_date)
              -- Row lama yang belum di-backfill: fallback ke month/week
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

-- ─── Helper: apply/reverse efek budget buat assignment eksplisit ────────────
-- Naik/turunin actual_amount kategori yang di-assign LANGSUNG (gak ada
-- matching sama sekali), lalu rollup ke budget induknya (baik budget si
-- kategori itu sendiri, maupun — kalau kategori ini adalah anak dari kategori
-- bulanan lewat parent_budget_category_id — total_actual budget bulanan itu
-- ikut ke-refresh juga).
create or replace function public.apply_budget_category_effect(
  p_budget_category_id uuid,
  p_amount              numeric
) returns void
language plpgsql
security invoker
as $$
declare
  v_budget_id uuid;
  v_parent_monthly_budget_id uuid;
begin
  if p_budget_category_id is null then
    return;
  end if;

  update public.budget_categories
  set actual_amount = actual_amount + p_amount
  where id = p_budget_category_id
  returning budget_id into v_budget_id;

  if v_budget_id is null then
    return; -- kategori/budget-nya udah gak ada (mungkin kehapus)
  end if;

  update public.budgets
  set total_actual = (
    select coalesce(sum(actual_amount), 0)
    from public.budget_categories where budget_id = v_budget_id
  )
  where id = v_budget_id;

  -- Rollup ke budget BULANAN kalau budget si kategori ini (mingguan) punya
  -- parent_budget_id — total_actual budget bulanan = SUM semua transaksi
  -- yang ke-assign eksplisit di seluruh minggu di bawahnya (lewat kategori
  -- yang mapped_category_ids-nya udah disalin dari induk, atau lewat
  -- kategori bulanan yang ini adalah anaknya).
  select parent_budget_id into v_parent_monthly_budget_id
  from public.budgets where id = v_budget_id;

  if v_parent_monthly_budget_id is not null then
    update public.budgets
    set total_actual = (
      select coalesce(sum(actual_amount), 0)
      from public.budget_categories where budget_id = v_parent_monthly_budget_id
    )
    where id = v_parent_monthly_budget_id;
  end if;
end;
$$;

-- ─── add_transaction_with_effects: tambah param budget_category_id ──────────
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
  p_override_budget_id uuid default null,
  p_budget_category_id uuid default null
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
    to_account_id, recurring_id, notes, budget_category_id
  ) values (
    v_user_id, p_type, p_name, p_description, p_category_id, p_amount, p_date,
    p_payment_method, p_status, p_attachment_url, p_debt_id, p_account_id,
    p_to_account_id, p_recurring_id, p_notes, p_budget_category_id
  )
  returning * into v_tx;

  if p_type = 'debt_payment' and p_debt_id is not null then
    insert into public.debt_payments (debt_id, transaction_id, amount, date)
    values (p_debt_id, v_tx.id, p_amount, p_date);
  end if;

  if p_type in ('expense', 'debt_payment', 'saving') then
    if p_budget_category_id is not null then
      -- Jalur eksplisit: langsung, gak lewat matching apapun.
      perform public.apply_budget_category_effect(p_budget_category_id, p_amount);
    else
      -- Jalur lama: fuzzy-match (behavior gak berubah).
      select name into v_category_name from public.categories where id = p_category_id;
      perform public.sync_budget_actual(
        v_user_id, p_amount, p_date, p_override_budget_id,
        p_category_id, coalesce(v_category_name, ''), p_name
      );
    end if;
  end if;

  return jsonb_build_object(
    'id', v_tx.id, 'user_id', v_tx.user_id, 'type', v_tx.type, 'name', v_tx.name,
    'description', v_tx.description, 'category_id', v_tx.category_id,
    'amount', v_tx.amount, 'date', v_tx.date, 'payment_method', v_tx.payment_method,
    'status', v_tx.status, 'attachment_url', v_tx.attachment_url, 'debt_id', v_tx.debt_id,
    'account_id', v_tx.account_id, 'to_account_id', v_tx.to_account_id,
    'recurring_id', v_tx.recurring_id, 'notes', v_tx.notes, 'budget_category_id', v_tx.budget_category_id,
    'created_at', v_tx.created_at, 'updated_at', v_tx.updated_at,
    'category', (select to_jsonb(c) from public.categories c where c.id = v_tx.category_id)
  );
end;
$$;
