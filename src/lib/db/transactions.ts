import { getSupabaseUser } from "./client";
import { syncBudgetActual, applyBudgetCategoryEffect } from "./budget-sync";
import type { Transaction } from "@/types";

// ─── Transactions ─────────────────────────────────────────────────────────────
export async function getTransactions(filters?: { type?: string; search?: string; accountId?: string; limit?: number; dateFrom?: string; dateTo?: string }) {
    const { supabase, userId } = await getSupabaseUser();
    // Embed akun lewat nama constraint FK (transactions punya 2 FK ke accounts:
    // account_id & to_account_id), jadi PostgREST butuh disambiguasi eksplisit.
    let query = supabase
        .from("transactions")
        .select(`
            *,
            category:categories(*),
            account:accounts!transactions_account_id_fkey(*),
            to_account:accounts!transactions_to_account_id_fkey(*)
        `)
        .eq("user_id", userId)
        // date doang gak cukup buat urutan stabil — kalau ada >1 transaksi di
        // tanggal yang sama, urutannya antar mereka gak konsisten tiap reload
        // (Postgres gak guarantee urutan tanpa secondary sort). created_at desc
        // sebagai tiebreak bikin urutan selalu sama & sesuai jam input.
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(filters?.limit ?? 100);

    if (filters?.type && filters.type !== "all") query = query.eq("type", filters.type);
    if (filters?.accountId && filters.accountId !== "all") query = query.eq("account_id", filters.accountId);
    if (filters?.search) query = query.ilike("name", `%${filters.search}%`);
    if (filters?.dateFrom) query = query.gte("date", filters.dateFrom);
    if (filters?.dateTo) query = query.lte("date", filters.dateTo);

    const { data, error } = await query;
    if (error) throw error;
    return data as Transaction[];
}

export async function addTransaction(
    tx: Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at" | "category" | "budget_category_id">,
    overrideBudgetId?: string | null,
    budgetCategoryId?: string | null,
) {
    const { supabase } = await getSupabaseUser();

    // Insert transaksi + (kalau debt_payment) catat debt_payments + sync budget
    // semuanya lewat 1 RPC ke fungsi `add_transaction_with_effects` di Postgres,
    // supaya jadi SATU database transaction yang atomic. Kalau salah satu
    // langkah gagal di tengah (mis. koneksi putus pas sync budget), SEMUA
    // efeknya di-rollback bareng — gak ada transaksi yang "nyangkut" tanpa
    // ke-sync ke debt/budget seperti versi lama (3 request JS berurutan).
    //
    // budgetCategoryId (opsional): assignment EKSPLISIT user ke kategori
    // budget tertentu (mis. "Minggu 1 > Kopi"). Kalau diisi, efeknya langsung
    // & pasti (gak lewat fuzzy-matching sync_budget_actual sama sekali) —
    // lihat apply_budget_category_effect di migration 006. Kalau kosong,
    // behavior lama (fuzzy-match / overrideBudgetId) tetap jalan persis
    // seperti sebelumnya.
    const { data, error } = await supabase.rpc("add_transaction_with_effects", {
        p_type: tx.type,
        p_name: tx.name,
        p_amount: tx.amount,
        p_date: tx.date,
        p_description: tx.description ?? null,
        p_category_id: tx.category_id || null,
        p_payment_method: tx.payment_method,
        p_status: tx.status,
        p_attachment_url: tx.attachment_url ?? null,
        p_debt_id: tx.debt_id ?? null,
        p_account_id: tx.account_id ?? null,
        p_to_account_id: tx.to_account_id ?? null,
        p_override_budget_id: overrideBudgetId ?? null,
        p_budget_category_id: budgetCategoryId ?? null,
    });
    if (error) throw error;

    return data as Transaction;
}

export async function deleteTransaction(id: string) {
    const { supabase, userId } = await getSupabaseUser();

    // Get transaction details before deleting, to reverse budget/debt sync if needed
    const { data: tx } = await supabase
        .from("transactions")
        .select("*, category:categories(*)")
        .eq("id", id)
        .single();

    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) throw error;

    if (tx && (tx.type === "expense" || tx.type === "debt_payment" || tx.type === "saving")) {
        if (tx.budget_category_id) {
            await applyBudgetCategoryEffect(tx.budget_category_id, -Number(tx.amount));
        } else {
            await syncBudgetActual(userId, tx.category?.name ?? "", -Number(tx.amount), tx.date, null, tx.category_id ?? null, tx.name ?? null);
        }
    }

    // If this was a debt payment, remove the linked debt_payments row too.
    // Trigger sync_debt_payment (migration 009) sekarang juga nyala pas
    // delete, jadi debts.total_paid/status ikut direcalculate otomatis.
    if (tx && tx.type === "debt_payment" && tx.debt_id) {
        await supabase.from("debt_payments").delete().eq("transaction_id", id);
    }
}

export async function updateTransaction(
    id: string,
    tx: Partial<Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at" | "category">>
) {
    const { supabase, userId } = await getSupabaseUser();

    // Get original transaction to reverse old budget sync if amount/category/date changes
    const { data: original } = await supabase
        .from("transactions")
        .select("*, category:categories(*)")
        .eq("id", id)
        .single();

    const { data, error } = await supabase
        .from("transactions")
        .update({ ...tx, category_id: tx.category_id || null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*, category:categories(*)")
        .single();
    if (error) throw error;

    // Reverse old sync, then apply new sync (relevant for expense, debt_payment & saving).
    // Kalau assignment-nya eksplisit (budget_category_id), reverse/apply langsung ke situ —
    // gak lewat fuzzy-matching, jadi gak mungkin salah nyantol ke kategori lain.
    if (original && (original.type === "expense" || original.type === "debt_payment" || original.type === "saving")) {
        if (original.budget_category_id) {
            await applyBudgetCategoryEffect(original.budget_category_id, -Number(original.amount));
        } else {
            await syncBudgetActual(userId, original.category?.name ?? "", -Number(original.amount), original.date, null, original.category_id ?? null, original.name ?? null);
        }
    }
    if (data.type === "expense" || data.type === "debt_payment" || data.type === "saving") {
        if (data.budget_category_id) {
            await applyBudgetCategoryEffect(data.budget_category_id, Number(data.amount));
        } else {
            await syncBudgetActual(userId, data.category?.name ?? "", Number(data.amount), data.date, null, data.category_id ?? null, data.name ?? null);
        }
    }

    // Sync debt_payments row juga (trigger sync_debt_payment yang recalculate
    // debts.total_paid/status). Reverse dulu row lama (kalau ada), baru insert
    // row baru (kalau transaksi hasil edit-nya masih/jadi debt_payment dengan
    // debt_id terisi). Delete + insert dipilih daripada update biasa supaya
    // kasus debt_id berubah tetap trigger recalculate debt lama & baru dua-duanya.
    if (original && original.type === "debt_payment" && original.debt_id) {
        await supabase.from("debt_payments").delete().eq("transaction_id", id);
    }
    if (data.type === "debt_payment" && data.debt_id) {
        const { error: dpError } = await supabase.from("debt_payments").insert({
            debt_id: data.debt_id,
            transaction_id: data.id,
            amount: data.amount,
            date: data.date,
        });
        if (dpError) throw dpError;
    }

    return data as Transaction;
}

