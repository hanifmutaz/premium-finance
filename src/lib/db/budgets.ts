import { getSupabaseUser } from "./client";
import { matchBudgetCategory } from "./budget-sync";

// ─── Budgets ──────────────────────────────────────────────────────────────────
export async function getBudgets() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("budgets")
        .select("*, categories:budget_categories(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
}

export async function addBudget(budget: {
    name: string; period: string; year: number; month?: number; week?: number;
    start_date?: string | null; end_date?: string | null;
    total_income: number; notes?: string;
    parent_budget_id?: string | null;
    weekly_source_category?: string | null;
    categories: {
        name: string; planned_amount: number; color?: string;
        mapped_category_ids?: string[] | null;
        keyword_filter?: string | null;
        // Kalau diisi, mapped_category_ids/keyword_filter di atas DIABAIKAN
        // dan di-resolve otomatis dari kategori bulanan induk ini — jadi
        // form gak perlu minta user isi mapping dua kali buat budget
        // mingguan yang sebenarnya "irisan" dari kategori bulanan yang sama.
        parent_budget_category_id?: string | null;
    }[];
}) {
    const { supabase, userId } = await getSupabaseUser();
    const { categories, ...budgetData } = budget;
    const total_planned = categories.reduce((s, c) => s + c.planned_amount, 0);

    const { data: bud, error } = await supabase
        .from("budgets")
        .insert({ ...budgetData, user_id: userId, total_planned, total_actual: 0 })
        .select()
        .single();
    if (error) throw error;

    if (categories.length > 0) {
        // Resolve mapping dari kategori induk buat yang direference
        const parentIds = categories
            .map((c) => c.parent_budget_category_id)
            .filter((id): id is string => !!id);
        let parentMap = new Map<string, { mapped_category_ids: string[] | null; keyword_filter: string | null }>();
        if (parentIds.length > 0) {
            const { data: parents } = await supabase
                .from("budget_categories")
                .select("id, mapped_category_ids, keyword_filter")
                .in("id", parentIds);
            parentMap = new Map((parents ?? []).map((p) => [p.id, p]));
        }

        await supabase.from("budget_categories").insert(
            categories.map((c) => {
                const parent = c.parent_budget_category_id ? parentMap.get(c.parent_budget_category_id) : undefined;
                return {
                    name: c.name,
                    planned_amount: c.planned_amount,
                    color: c.color,
                    budget_id: bud.id,
                    actual_amount: 0,
                    parent_budget_category_id: c.parent_budget_category_id ?? null,
                    mapped_category_ids: parent ? parent.mapped_category_ids : (c.mapped_category_ids ?? null),
                    keyword_filter: parent ? parent.keyword_filter : (c.keyword_filter ?? null),
                };
            })
        );
    }
    return bud;
}

export async function deleteBudget(id: string) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) throw error;
}

export async function updateBudget(id: string, budget: {
    name: string; total_income: number; notes?: string;
    year?: number; month?: number | null; week?: number | null;
    start_date?: string | null; end_date?: string | null;
    // Dulu gak bisa diubah lagi sesudah budget mingguan dibikin — sekarang
    // boleh, biar user bisa reconfigure/relink ke budget bulanan pas edit.
    parent_budget_id?: string | null;
    weekly_source_category?: string | null;
    categories: {
        id?: string; name: string; planned_amount: number; actual_amount?: number; color?: string;
        mapped_category_ids?: string[] | null;
        keyword_filter?: string | null;
        parent_budget_category_id?: string | null;
    }[];
}) {
    const { supabase } = await getSupabaseUser();
    const { categories, ...budgetData } = budget;
    const total_planned = categories.reduce((s, c) => s + c.planned_amount, 0);
    // total_actual SENGAJA gak dihitung dari form di sini (bisa stale) —
    // di-recompute dari data DB asli di akhir fungsi, setelah upsert kategori.

    const { data: bud, error } = await supabase
        .from("budgets")
        .update({ ...budgetData, total_planned, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;

    // Resolve mapping dari kategori induk buat yang direference (sama kayak addBudget)
    const parentIds = categories
        .map((c) => c.parent_budget_category_id)
        .filter((id): id is string => !!id);
    let parentMap = new Map<string, { mapped_category_ids: string[] | null; keyword_filter: string | null }>();
    if (parentIds.length > 0) {
        const { data: parents } = await supabase
            .from("budget_categories")
            .select("id, mapped_category_ids, keyword_filter")
            .in("id", parentIds);
        parentMap = new Map((parents ?? []).map((p) => [p.id, p]));
    }

    // Upsert per-kategori — BUKAN delete-all+insert-all. Delete+insert bikin
    // row ID baru tiap kali budget di-edit, yang artinya:
    //   1. Transaksi yang udah nempel eksplisit (budget_category_id) ke
    //      kategori itu KEPUTUS (FK-nya ON DELETE SET NULL)
    //   2. actual_amount ke-reset ke apapun yang lagi ada di form (bisa stale)
    // Kategori yang UDAH ADA (punya id) di-UPDATE di tempat, TANPA nyentuh
    // actual_amount sama sekali (itu field yang di-maintain live oleh
    // applyBudgetCategoryEffect/syncBudgetActual, bukan sesuatu yang
    // di-submit dari form ini). Kategori baru (gak ada id) di-insert. Yang
    // beneran dihapus user dari form → baru itu yang di-delete dari DB.
    const { data: existingCats } = await supabase
        .from("budget_categories")
        .select("id")
        .eq("budget_id", id);
    const existingIds = new Set((existingCats ?? []).map((c) => c.id));
    const submittedIds = new Set(categories.map((c) => c.id).filter((v): v is string => !!v));

    const toDelete = Array.from(existingIds).filter((cid) => !submittedIds.has(cid));
    if (toDelete.length > 0) {
        await supabase.from("budget_categories").delete().in("id", toDelete);
    }

    for (const c of categories) {
        const parent = c.parent_budget_category_id ? parentMap.get(c.parent_budget_category_id) : undefined;
        const payload = {
            name: c.name,
            planned_amount: c.planned_amount,
            color: c.color,
            parent_budget_category_id: c.parent_budget_category_id ?? null,
            mapped_category_ids: parent ? parent.mapped_category_ids : (c.mapped_category_ids ?? null),
            keyword_filter: parent ? parent.keyword_filter : (c.keyword_filter ?? null),
        };
        if (c.id && existingIds.has(c.id)) {
            // Sengaja gak ada actual_amount di sini — biar gak ketimpa.
            await supabase.from("budget_categories").update(payload).eq("id", c.id);
        } else {
            await supabase.from("budget_categories").insert({ ...payload, budget_id: id, actual_amount: 0 });
        }
    }

    // total_actual dihitung dari nilai actual_amount yang BENERAN ada di DB
    // sekarang (bukan dari c.actual_amount form yang bisa stale).
    const { data: freshCats } = await supabase
        .from("budget_categories")
        .select("actual_amount")
        .eq("budget_id", id);
    const freshTotalActual = (freshCats ?? []).reduce((s, c) => s + Number(c.actual_amount), 0);
    await supabase.from("budgets").update({ total_actual: freshTotalActual }).eq("id", id);

    return { ...bud, total_actual: freshTotalActual };
}

// ─── Recalculate budget actual dari histori transaksi ────────────────────────
// Beda sama syncBudgetActual (yang cuma nambah/kurang incremental pas ada
// transaksi baru/dihapus/diedit), fungsi ini nge-scan ULANG semua transaksi
// di periode budget ini dan itung actual_amount dari nol pake mapping yang
// SEKARANG berlaku. Berguna buat "nyembuhin" budget yang actual_amount-nya
// kebawah karena ada transaksi lama yang gak ke-capture waktu itu (mis. belum
// di-mapping ke kategori transaksi manapun).
export async function recalculateBudgetActual(budgetId: string) {
    const { supabase, userId } = await getSupabaseUser();

    const { data: budget, error: budgetErr } = await supabase
        .from("budgets")
        .select("id, period, year, month, week, start_date, end_date")
        .eq("id", budgetId)
        .eq("user_id", userId)
        .single();
    if (budgetErr || !budget) throw budgetErr ?? new Error("Budget tidak ditemukan");

    const { data: cats, error: catsErr } = await supabase
        .from("budget_categories")
        .select("id, name, mapped_category_ids, keyword_filter")
        .eq("budget_id", budgetId)
        .order("created_at", { ascending: true });
    if (catsErr) throw catsErr;
    if (!cats || cats.length === 0) return;

    // Rentang tanggal transaksi yang relevan buat periode budget ini.
    // Monthly: sebulan penuh. Weekly: pakai start_date/end_date asli kalau
    // udah ada (row baru selalu punya ini — lihat migration 005). Row lama
    // yang belum ke-backfill fallback ke definisi minggu = hari/7 yang lama.
    const toISODate = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const monthStart = new Date(budget.year, (budget.month ?? 1) - 1, 1);
    const monthEnd = new Date(budget.year, (budget.month ?? 1), 0); // hari terakhir bulan itu
    let rangeStartISO = toISODate(monthStart);
    let rangeEndISO = toISODate(monthEnd);

    if (budget.period === "weekly") {
        if (budget.start_date && budget.end_date) {
            rangeStartISO = budget.start_date;
            rangeEndISO = budget.end_date;
        } else if (budget.week) {
            const dayStart = (budget.week - 1) * 7 + 1;
            const dayEnd = Math.min(budget.week * 7, monthEnd.getDate());
            rangeStartISO = toISODate(new Date(budget.year, (budget.month ?? 1) - 1, dayStart));
            rangeEndISO = toISODate(new Date(budget.year, (budget.month ?? 1) - 1, dayEnd));
        }
    }

    const catIds = cats.map((c) => c.id);
    const totals = new Map<string, number>(cats.map((c) => [c.id, 0]));

    // Pass 1 — EKSPLISIT: dicari lewat budget_category_id LANGSUNG, TANPA
    // filter tanggal sama sekali. Assignment eksplisit sengaja didesain
    // lepas dari tanggal transaksi (kasus "belanja akhir bulan buat jatah
    // bulan depan" — lihat picker di form transaksi), jadi resync juga harus
    // ikut nyari berdasar assignment-nya, bukan mbatesin ke rentang tanggal
    // budget ini (kalau dibatesin, transaksi yang tanggalnya di luar bulan
    // budget tapi sengaja di-assign ke sini bakal ke-skip & ke-reset ke 0).
    const { data: explicitTxs, error: explicitErr } = await supabase
        .from("transactions")
        .select("amount, budget_category_id")
        .eq("user_id", userId)
        .in("type", ["expense", "debt_payment", "saving"])
        .in("budget_category_id", catIds);
    if (explicitErr) throw explicitErr;
    for (const tx of explicitTxs ?? []) {
        if (!tx.budget_category_id) continue;
        totals.set(tx.budget_category_id, (totals.get(tx.budget_category_id) ?? 0) + Number(tx.amount));
    }

    // Pass 2 — FUZZY: transaksi yang budget_category_id-nya NULL (gak
    // di-assign eksplisit sama sekali) tetep dicari lewat rentang tanggal +
    // matchBudgetCategory kayak sebelumnya, biar transaksi lama/yang
    // di-skip user ("Otomatis") tetep kehitung.
    const { data: fuzzyTxs, error: fuzzyErr } = await supabase
        .from("transactions")
        .select("amount, date, name, category_id, category:categories(name), type, budget_category_id")
        .eq("user_id", userId)
        .in("type", ["expense", "debt_payment", "saving"])
        .is("budget_category_id", null)
        .gte("date", rangeStartISO)
        .lte("date", rangeEndISO);
    if (fuzzyErr) throw fuzzyErr;
    for (const tx of fuzzyTxs ?? []) {
        const catName = (tx.category as { name?: string } | null)?.name ?? "";
        const matched = matchBudgetCategory(cats, tx.category_id ?? null, catName, tx.name ?? null);
        if (!matched) continue;
        totals.set(matched.id, (totals.get(matched.id) ?? 0) + Number(tx.amount));
    }

    // Rollup: kategori BULANAN yang punya "anak" di budget mingguan (lewat
    // parent_budget_category_id) — actual_amount-nya = SUM semua anaknya,
    // bukan hasil matching sendiri (biar gak dobel-hitung & selalu akurat
    // tanpa perlu setup mapping terpisah di level bulanan).
    if (budget.period === "monthly") {
        const { data: children } = await supabase
            .from("budget_categories")
            .select("actual_amount, parent_budget_category_id")
            .in("parent_budget_category_id", cats.map((c) => c.id));
        if (children && children.length > 0) {
            const rollup = new Map<string, number>();
            for (const ch of children) {
                if (!ch.parent_budget_category_id) continue;
                rollup.set(ch.parent_budget_category_id, (rollup.get(ch.parent_budget_category_id) ?? 0) + Number(ch.actual_amount));
            }
            for (const [parentId, sum] of Array.from(rollup)) totals.set(parentId, sum);
        }
    }

    for (const cat of cats) {
        await supabase
            .from("budget_categories")
            .update({ actual_amount: totals.get(cat.id) ?? 0 })
            .eq("id", cat.id);
    }

    const totalActual = Array.from(totals.values()).reduce((s, v) => s + v, 0);
    await supabase.from("budgets").update({ total_actual: totalActual }).eq("id", budgetId);

    return { total_actual: totalActual, per_category: Object.fromEntries(totals) };
}

