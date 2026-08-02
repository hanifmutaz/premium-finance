import { getSupabaseUser } from "./client";
import { createClient } from "@/lib/supabase/client";

// ─── Budget category matching (dipakai bareng oleh sync live & recalculate) ──
// Prioritas: 1) mapped_category_ids cocok + keyword_filter match nama transaksi,
// 2) mapped_category_ids cocok tanpa keyword, 3) keyword_filter cocok di nama
// transaksi (buat debt_payment/saving tanpa kategori), 4) fallback nama sama persis.
type MatchableBudgetCat = {
    id: string; name: string;
    mapped_category_ids: string[] | null;
    keyword_filter: string | null;
};

export function matchBudgetCategory<T extends MatchableBudgetCat>(
    cats: T[],
    txCategoryId: string | null,
    categoryName: string,
    txName: string | null,
): T | null {
    if (txCategoryId) {
        for (const cat of cats) {
            const mapped = cat.mapped_category_ids;
            if (!mapped || !mapped.includes(txCategoryId)) continue;
            if (cat.keyword_filter && txName) {
                if (!txName.toLowerCase().includes(cat.keyword_filter.toLowerCase())) continue;
            }
            return cat;
        }
    }
    if (txName) {
        for (const cat of cats) {
            if (!cat.keyword_filter) continue;
            if (txName.toLowerCase().includes(cat.keyword_filter.toLowerCase())) return cat;
        }
    }
    if (categoryName) {
        const found = cats.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
        if (found) return found;
    }
    return null;
}

// ─── Budget sync helper ─────────────────────────────────────────────────────
// Finds the active budget covering the transaction date, matches the category
// by name (case-insensitive), and bumps actual_amount + total_actual.
export async function syncBudgetActual(
    userId: string,
    categoryName: string,
    amount: number,
    txDate: string,
    overrideBudgetId?: string | null,
    txCategoryId?: string | null,   // ID kategori transaksi (untuk mapping)
    txName?: string | null,          // Nama transaksi (untuk keyword_filter)
) {
    const supabase = createClient();
    const date = new Date(txDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    // Fallback buat row weekly lama yang belum ke-backfill start_date/end_date
    // (lihat migration 005). Row baru selalu punya start_date/end_date, jadi
    // gak lagi bergantung ke "minggu ke-N dari hari/7" ini.
    const dayOfMonth = date.getDate();
    const legacyWeek = Math.ceil(dayOfMonth / 7);

    let budgets: { id: string; period: string; year: number; month?: number; week?: number; parent_budget_id?: string | null }[] | null = null;

    if (overrideBudgetId) {
        // Ambil budget yang dipilih user
        const { data } = await supabase
            .from("budgets")
            .select("id, period, year, month, week, parent_budget_id")
            .eq("id", overrideBudgetId)
            .eq("user_id", userId);
        budgets = data ?? [];

        // Kalau budget ini punya parent (budget mingguan → bulanan),
        // ikut-sertakan parent-nya juga supaya keduanya ter-sync
        const parentId = budgets?.[0]?.parent_budget_id;
        if (parentId) {
            const { data: parentData } = await supabase
                .from("budgets")
                .select("id, period, year, month, week, parent_budget_id")
                .eq("id", parentId)
                .eq("user_id", userId);
            if (parentData && parentData.length > 0) {
                budgets = [...budgets, ...parentData];
            }
        }
    } else {
        // 1) Budget bulanan yang cover tanggal ini
        const { data: monthlyData } = await supabase
            .from("budgets")
            .select("id, period, year, month, week, parent_budget_id")
            .eq("user_id", userId)
            .eq("period", "monthly")
            .eq("year", year)
            .eq("month", month);

        // 2) Budget mingguan yang rentang start_date/end_date-nya cover tanggal ini
        //    (sumber utama — akurat, gak peduli minggu itu lintas bulan/tahun)
        const { data: weeklyByDate } = await supabase
            .from("budgets")
            .select("id, period, year, month, week, parent_budget_id, start_date, end_date")
            .eq("user_id", userId)
            .eq("period", "weekly")
            .lte("start_date", txDate)
            .gte("end_date", txDate);

        // 3) Fallback: budget mingguan LAMA yang belum punya start_date/end_date
        //    (masih pakai definisi minggu = hari/7 yang lama)
        const { data: weeklyLegacy } = await supabase
            .from("budgets")
            .select("id, period, year, month, week, parent_budget_id, start_date")
            .eq("user_id", userId)
            .eq("period", "weekly")
            .eq("year", year)
            .eq("month", month)
            .eq("week", legacyWeek)
            .is("start_date", null);

        budgets = [...(monthlyData ?? []), ...(weeklyByDate ?? []), ...(weeklyLegacy ?? [])];

        // Ikut-sertakan parent budget dari weekly yang belum ada di list
        const existingIds = new Set(budgets.map((b) => b.id));
        const parentIds = budgets
            .map((b) => b.parent_budget_id)
            .filter((id): id is string => !!id && !existingIds.has(id));

        if (parentIds.length > 0) {
            const { data: parentData } = await supabase
                .from("budgets")
                .select("id, period, year, month, week, parent_budget_id")
                .in("id", parentIds)
                .eq("user_id", userId);
            if (parentData) budgets = [...budgets, ...parentData];
        }
    }

    if (!budgets || budgets.length === 0) return;

    for (const budget of budgets) {
        // Ambil semua budget categories beserta field mapping-nya
        const { data: allCats } = await supabase
            .from("budget_categories")
            .select("id, name, actual_amount, mapped_category_ids, keyword_filter")
            .eq("budget_id", budget.id)
            .order("created_at", { ascending: true });

        if (!allCats || allCats.length === 0) continue;

        const matchedCat = matchBudgetCategory(allCats, txCategoryId ?? null, categoryName, txName ?? null);
        if (!matchedCat) continue;

        const newActual = Number(matchedCat.actual_amount) + amount;
        await supabase
            .from("budget_categories")
            .update({ actual_amount: newActual })
            .eq("id", matchedCat.id);

        // Recalculate budget total_actual
        const { data: refreshedCats } = await supabase
            .from("budget_categories")
            .select("actual_amount")
            .eq("budget_id", budget.id);

        const totalActual = (refreshedCats ?? []).reduce((s, c) => s + Number(c.actual_amount), 0);
        await supabase.from("budgets").update({ total_actual: totalActual }).eq("id", budget.id);
    }
}

// Versi JS dari apply_budget_category_effect (SQL) — dipakai delete/update
// transaksi yang budget_category_id-nya diisi eksplisit, biar gak lewat
// fuzzy-matching sama sekali (langsung & pasti kena kategori yang di-assign).
export async function applyBudgetCategoryEffect(budgetCategoryId: string, amount: number) {
    const supabase = createClient();
    // Supabase JS gak punya "increment" langsung tanpa baca dulu — baca actual_amount, tambah, tulis.
    const { data: current } = await supabase
        .from("budget_categories")
        .select("id, budget_id, actual_amount, parent_budget_category_id")
        .eq("id", budgetCategoryId)
        .single();
    if (!current) return; // kategori/budget-nya udah gak ada (mis. kehapus)

    await supabase
        .from("budget_categories")
        .update({ actual_amount: Number(current.actual_amount) + amount })
        .eq("id", budgetCategoryId);

    const { data: refreshedCats } = await supabase
        .from("budget_categories")
        .select("actual_amount")
        .eq("budget_id", current.budget_id);
    const totalActual = (refreshedCats ?? []).reduce((s, c) => s + Number(c.actual_amount), 0);
    await supabase.from("budgets").update({ total_actual: totalActual }).eq("id", current.budget_id);

    // Rollup ke KATEGORI BULANAN spesifik yang jadi induknya (kalau kategori
    // ini "anak" — link lewat parent_budget_category_id, mis. kategori "Kopi"
    // di minggu 1 yang nempel ke kategori "Minggu 1" di budget bulanan).
    // PENTING: recompute actual_amount kategori INDUK-nya dari SUM semua
    // anaknya — bukan cuma recompute total budget doang, soalnya breakdown
    // per-kategori di bulanan juga harus ke-update, gak cuma totalnya.
    if (current.parent_budget_category_id) {
        const { data: siblings } = await supabase
            .from("budget_categories")
            .select("actual_amount")
            .eq("parent_budget_category_id", current.parent_budget_category_id);
        const siblingTotal = (siblings ?? []).reduce((s, c) => s + Number(c.actual_amount), 0);

        const { data: parentCat } = await supabase
            .from("budget_categories")
            .update({ actual_amount: siblingTotal })
            .eq("id", current.parent_budget_category_id)
            .select("budget_id")
            .single();

        if (parentCat?.budget_id) {
            const { data: parentBudgetCats } = await supabase
                .from("budget_categories")
                .select("actual_amount")
                .eq("budget_id", parentCat.budget_id);
            const parentBudgetTotal = (parentBudgetCats ?? []).reduce((s, c) => s + Number(c.actual_amount), 0);
            await supabase.from("budgets").update({ total_actual: parentBudgetTotal }).eq("id", parentCat.budget_id);
        }
    }
}
