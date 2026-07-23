import { createClient } from "@/lib/supabase/client";
import type { Transaction, Debt, Goal, Wishlist, Receivable, Notification, Category, Account, AccountType, AccountWithBalance } from "@/types";

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getSupabaseUser() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Not authenticated");
    return { supabase, userId: session.user.id };
}

// ─── Seed default categories ──────────────────────────────────────────────────
export async function seedDefaultCategories(userId: string) {
    const supabase = createClient();
    const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

    if (existing && existing.length > 0) return;

    const defaults = [
        { name: "Gaji", type: "income" },
        { name: "Freelance", type: "income" },
        { name: "Bonus", type: "income" },
        { name: "THR", type: "income" },
        { name: "Investasi", type: "income" },
        { name: "Lainnya", type: "income" },
        { name: "Makan", type: "expense" },
        { name: "Transport", type: "expense" },
        { name: "Tagihan", type: "expense" },
        { name: "Keluarga", type: "expense" },
        { name: "Belanja", type: "expense" },
        { name: "Kesehatan", type: "expense" },
        { name: "Hiburan", type: "expense" },
        { name: "Investasi Diri", type: "expense" },
        { name: "Lainnya", type: "expense" },
    ];

    await supabase.from("categories").insert(
        defaults.map((c) => ({ ...c, user_id: userId }))
    );
}

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

// ─── Accounts (Sumber Dana) ─────────────────────────────────────────────────
export async function getAccounts(): Promise<AccountWithBalance[]> {
    const { supabase, userId } = await getSupabaseUser();

    const [{ data: accounts, error: accError }, { data: txs, error: txError }] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", userId).order("created_at"),
        supabase.from("transactions").select("type, amount, date, account_id, to_account_id").eq("user_id", userId),
    ]);
    if (accError) throw accError;
    if (txError) throw txError;

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    // Saldo per akun = saldo_awal + semua transaksi yang nyentuh akun ini.
    // "transfer" itu khusus: ngurangin akun asal (account_id), nambahin akun
    // tujuan (to_account_id). Tipe lain (income/expense/debt_payment/saving/
    // receivable_out) cuma nyentuh satu akun (account_id) — income nambah,
    // sisanya (termasuk receivable_out, piutang keluar) ngurangin.
    return (accounts ?? []).map((acc) => {
        let balance = Number(acc.initial_balance);
        let monthly_expense = 0;
        (txs ?? []).forEach((t) => {
            const amt = Number(t.amount);
            if (t.type === "transfer") {
                if (t.account_id === acc.id) balance -= amt;
                if (t.to_account_id === acc.id) balance += amt;
            } else if (t.account_id === acc.id) {
                balance += t.type === "income" ? amt : -amt;

                // "Pengeluaran" di sini ngikutin definisi yang udah dipakai di
                // halaman Transaksi: semua tipe selain income & transfer
                // (expense, debt_payment, saving) — bukan cuma type="expense".
                if (t.type !== "income") {
                    const d = new Date(t.date);
                    if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
                        monthly_expense += amt;
                    }
                }
            }
        });
        return { ...acc, balance, monthly_expense } as AccountWithBalance;
    });
}

export async function addAccount(account: { name: string; type: AccountType; initial_balance: number; color?: string }) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("accounts")
        .insert({ ...account, user_id: userId })
        .select()
        .single();
    if (error) throw error;
    return data as Account;
}

export async function updateAccount(id: string, account: { name?: string; type?: AccountType; initial_balance?: number; color?: string }) {
    const { supabase } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("accounts")
        .update({ ...account, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Account;
}

export async function deleteAccount(id: string) {
    const { supabase } = await getSupabaseUser();
    // Transaksi lama yang masih nempel ke akun ini TIDAK ikut terhapus —
    // cuma jadi "tanpa akun" (FK on delete set null).
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) throw error;
}

export async function transferBetweenAccounts(params: {
    from_account_id: string; to_account_id: string; amount: number; date: string; notes?: string;
}) {
    const { supabase, userId } = await getSupabaseUser();
    if (params.from_account_id === params.to_account_id) {
        throw new Error("Akun asal dan tujuan gak boleh sama");
    }
    const { data, error } = await supabase
        .from("transactions")
        .insert({
            user_id: userId,
            type: "transfer",
            name: "Transfer Antar Akun",
            description: params.notes || undefined,
            amount: params.amount,
            date: params.date,
            payment_method: "transfer",
            status: "completed",
            account_id: params.from_account_id,
            to_account_id: params.to_account_id,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Transaction;
}

// ─── Budget category matching (dipakai bareng oleh sync live & recalculate) ──
// Prioritas: 1) mapped_category_ids cocok + keyword_filter match nama transaksi,
// 2) mapped_category_ids cocok tanpa keyword, 3) keyword_filter cocok di nama
// transaksi (buat debt_payment/saving tanpa kategori), 4) fallback nama sama persis.
type MatchableBudgetCat = {
    id: string; name: string;
    mapped_category_ids: string[] | null;
    keyword_filter: string | null;
};

function matchBudgetCategory<T extends MatchableBudgetCat>(
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
async function syncBudgetActual(
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
async function applyBudgetCategoryEffect(budgetCategoryId: string, amount: number) {
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

// ─── Debts ────────────────────────────────────────────────────────────────────
export async function getDebts() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("debts")
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true });
    if (error) throw error;
    return data as Debt[];
}

export async function addDebt(debt: {
    name: string; lender: string; total_amount: number;
    start_date: string; due_date: string; priority: string; notes?: string;
    is_installment?: boolean; installment_amount?: number | null; tenor_months?: number | null;
}) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("debts")
        .insert({
            ...debt,
            user_id: userId,
            total_paid: 0,
            status: "active",
            is_installment: debt.is_installment ?? false,
            installments_paid: 0,
            next_due_date: debt.due_date,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Debt;
}

export async function deleteDebt(id: string) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) throw error;
}

export async function updateDebt(id: string, debt: {
    name: string; lender: string; total_amount: number;
    start_date: string; due_date: string; priority: string; notes?: string;
    is_installment?: boolean; installment_amount?: number | null; tenor_months?: number | null;
}) {
    const { supabase } = await getSupabaseUser();

    // If switching to non-installment, clear installment-specific fields
    const installmentClear = debt.is_installment === false
        ? { installments_paid: null, next_due_date: null, installment_amount: null, tenor_months: null }
        : {};

    const { data, error } = await supabase
        .from("debts")
        .update({ ...debt, ...installmentClear, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Debt;
}

// ─── Goals ────────────────────────────────────────────────────────────────────
export async function getGoals() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .order("deadline", { ascending: true });
    if (error) throw error;
    return data as Goal[];
}

export async function addGoal(goal: {
    name: string; target_amount: number; deadline: string;
    priority: string; notes?: string;
}) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("goals")
        .insert({ ...goal, user_id: userId, current_amount: 0, status: "active" })
        .select()
        .single();
    if (error) throw error;
    return data as Goal;
}

export async function updateGoalAmount(id: string, amount: number) {
    const { supabase } = await getSupabaseUser();

    // Auto-tandai "completed" kalau tabungan udah nyampe/lewat target.
    const { data: existing } = await supabase.from("goals").select("target_amount").eq("id", id).single();
    const payload: Record<string, unknown> = { current_amount: amount, updated_at: new Date().toISOString() };
    if (existing && amount >= Number(existing.target_amount)) payload.status = "completed";

    const { data, error } = await supabase
        .from("goals")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Goal;
}

export async function updateGoal(id: string, goal: {
    name: string; target_amount: number; deadline: string;
    priority: string; notes?: string;
}) {
    const { supabase } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("goals")
        .update({ ...goal, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Goal;
}

export async function deleteGoal(id: string) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) throw error;
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────
export async function getWishlist() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("wishlists")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Wishlist[];
}

export async function addWishlistItem(item: {
    name: string; category: string; price: number;
    priority: string; target_date?: string; notes?: string;
}) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("wishlists")
        .insert({ ...item, user_id: userId, saved_amount: 0, status: "pending" })
        .select()
        .single();
    if (error) throw error;
    return data as Wishlist;
}

// ─── Savings Overview ("Tabungan") ─────────────────────────────────────────
// Gabungan progress dari Goals (target aktif) + Wishlist (item pending) —
// representasi "total udah nabung berapa, dari target berapa" buat dashboard.
export interface SavingsOverviewItem {
    id: string;
    name: string;
    type: "goal" | "wishlist";
    saved: number;
    target: number;
}
export interface SavingsOverview {
    totalSaved: number;
    totalTarget: number;
    items: SavingsOverviewItem[];
}

export async function getSavingsOverview(): Promise<SavingsOverview> {
    const { supabase, userId } = await getSupabaseUser();

    const [{ data: goals, error: goalsError }, { data: wishlist, error: wishlistError }] = await Promise.all([
        supabase.from("goals").select("id, name, current_amount, target_amount").eq("user_id", userId).eq("status", "active"),
        supabase.from("wishlists").select("id, name, saved_amount, price").eq("user_id", userId).eq("status", "pending"),
    ]);
    if (goalsError) throw goalsError;
    if (wishlistError) throw wishlistError;

    const items: SavingsOverviewItem[] = [
        ...(goals ?? []).map((g) => ({
            id: g.id, name: g.name, type: "goal" as const,
            saved: Number(g.current_amount), target: Number(g.target_amount),
        })),
        ...(wishlist ?? []).map((w) => ({
            id: w.id, name: w.name, type: "wishlist" as const,
            saved: Number(w.saved_amount), target: Number(w.price),
        })),
    ].sort((a, b) => b.saved - a.saved);

    return {
        totalSaved: items.reduce((s, i) => s + i.saved, 0),
        totalTarget: items.reduce((s, i) => s + i.target, 0),
        items,
    };
}

// ─── Cumulative Savings (real, sejak transaksi pertama) ────────────────────
// Sum dari semua transaksi tipe "saving" — uang yang SENGAJA dipindahin ke
// tabungan, bukan sisa/leftover income-expense. Beda sama getSavingsOverview()
// (yang itu rollup dari progress Goals+Wishlist).
export async function getCumulativeSavings(): Promise<number> {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", userId)
        .eq("type", "saving");
    if (error) throw error;

    return (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
}

export async function updateWishlistSaving(id: string, saved_amount: number) {
    const { supabase } = await getSupabaseUser();
    // Catatan: sengaja gak auto-ubah status ke "saved" di sini — halaman /wishlist
    // saat ini cuma punya 2 bucket tampilan (pending vs purchased), jadi kalau status
    // di-flip ke "saved" tanpa halaman-nya nge-handle bucket itu, item bakal hilang
    // dari kedua daftar. "Tandai sudah dibeli" tetap manual lewat alur yang sudah ada.
    const { data, error } = await supabase
        .from("wishlists")
        .update({ saved_amount, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Wishlist;
}

export async function updateWishlistItem(id: string, item: {
    name: string; category: string; price: number;
    priority: string; target_date?: string; notes?: string;
}) {
    const { supabase } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("wishlists")
        .update({ ...item, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Wishlist;
}

export async function deleteWishlistItem(id: string) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("wishlists").delete().eq("id", id);
    if (error) throw error;
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function getCategories(type?: "income" | "expense") {
    const { supabase, userId } = await getSupabaseUser();
    await seedDefaultCategories(userId);

    let query = supabase.from("categories").select("*").eq("user_id", userId);
    if (type) query = query.eq("type", type);

    const { data, error } = await query.order("name");
    if (error) throw error;
    return data ?? [];
}

export async function addCategory(category: { name: string; type: "income" | "expense"; color?: string }) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("categories")
        .insert({ ...category, user_id: userId })
        .select()
        .single();
    if (error) throw error;
    return data as Category;
}

export async function updateCategory(id: string, category: { name: string; color?: string }) {
    const { supabase } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("categories")
        .update(category)
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    return data as Category;
}

export async function deleteCategory(id: string) {
    const { supabase } = await getSupabaseUser();
    // Transaksi yang masih pakai kategori ini akan otomatis jadi "Lainnya" (NULL)
    // begitu kategorinya dihapus — bukan ikut terhapus.
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────
export async function getDashboardStats(year?: number, month?: number) {
    const { supabase, userId } = await getSupabaseUser();

    // month di sini 0-indexed (samain sama Date#getMonth()) biar konsisten
    // sama sisa fungsi lain di file ini. Default: bulan berjalan.
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth();

    const firstDay = new Date(y, m, 1).toISOString().split("T")[0];
    const lastDay = new Date(y, m + 1, 0).toISOString().split("T")[0];

    const prevMonth = new Date(y, m - 1, 1);
    const prevFirstDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1).toISOString().split("T")[0];
    const prevLastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).toISOString().split("T")[0];

    const [txRes, prevTxRes, debtRes, recvRes] = await Promise.all([
        supabase.from("transactions").select("type, amount")
            .eq("user_id", userId).gte("date", firstDay).lte("date", lastDay),
        supabase.from("transactions").select("type, amount")
            .eq("user_id", userId).gte("date", prevFirstDay).lte("date", prevLastDay),
        supabase.from("debts").select("*").eq("user_id", userId).in("status", ["active", "overdue"]),
        supabase.from("receivables").select("*").eq("user_id", userId).eq("status", "active"),
    ]);

    const transactions = txRes.data ?? [];
    const prevTransactions = prevTxRes.data ?? [];
    const debts = (debtRes.data ?? []) as Debt[];
    const receivables = recvRes.data ?? [];

    const monthly_income = transactions.filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0);
    const monthly_expense = transactions.filter((t) => t.type !== "income" && t.type !== "transfer")
        .reduce((s, t) => s + Number(t.amount), 0);

    const prev_monthly_income = prevTransactions.filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0);
    const prev_monthly_expense = prevTransactions.filter((t) => t.type !== "income" && t.type !== "transfer")
        .reduce((s, t) => s + Number(t.amount), 0);

    // Real percentage change vs last month (null if no prior data to compare against)
    const income_trend = prev_monthly_income > 0
        ? Math.round(((monthly_income - prev_monthly_income) / prev_monthly_income) * 1000) / 10
        : null;
    const expense_trend = prev_monthly_expense > 0
        ? Math.round(((monthly_expense - prev_monthly_expense) / prev_monthly_expense) * 1000) / 10
        : null;

    const total_active_debt = debts.reduce((s, d) => s + Number(d.remaining), 0);
    const total_debt_amount = debts.reduce((s, d) => s + Number(d.total_amount), 0);
    const total_debt_paid = debts.reduce((s, d) => s + Number(d.total_paid), 0);

    // Total piutang aktif (uang yang masih harus diterima dari orang lain)
    const total_active_receivable = receivables.reduce((s, r) => s + Number(r.remaining), 0);

    // Nearest due: untuk cicilan pakai next_due_date, untuk utang biasa pakai due_date
    const nearest_due = [...debts].sort((a, b) => {
        const dateA = a.is_installment && a.next_due_date ? a.next_due_date : a.due_date;
        const dateB = b.is_installment && b.next_due_date ? b.next_due_date : b.due_date;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
    })[0] ?? null;

    return {
        monthly_income,
        monthly_expense,
        monthly_remaining: monthly_income - monthly_expense,
        current_balance: monthly_income - monthly_expense,
        income_trend,
        expense_trend,
        total_active_debt,
        total_active_receivable,
        debt_paid_percentage: total_debt_amount > 0
            ? Math.round((total_debt_paid / total_debt_amount) * 100) : 0,
        health_score: null,
        nearest_due,
    };
}

// ─── Monthly chart data ───────────────────────────────────────────────────────
export async function getMonthlyChartData(endYear?: number, endMonth?: number) {
    const { supabase, userId } = await getSupabaseUser();
    const months = [];

    const now = new Date();
    const anchor = new Date(endYear ?? now.getFullYear(), endMonth ?? now.getMonth(), 1);

    for (let i = 5; i >= 0; i--) {
        const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
        const monthName = d.toLocaleString("id-ID", { month: "short" });

        const { data } = await supabase.from("transactions").select("type, amount")
            .eq("user_id", userId).gte("date", firstDay).lte("date", lastDay);

        const income = (data ?? []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
        const expense = (data ?? []).filter((t) => t.type !== "income" && t.type !== "transfer").reduce((s, t) => s + Number(t.amount), 0);
        months.push({ month: monthName, income, expense, balance: income - expense });
    }
    return months;
}

// ─── Recurring Transactions ───────────────────────────────────────────────────
export async function getRecurringTransactions() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("recurring_transactions")
        .select("*, category:categories(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
}

export async function addRecurringTransaction(rec: {
    name: string; type: "income" | "expense"; amount: number;
    category_id?: string; payment_method: string; frequency: "monthly" | "weekly";
    day_of_period: number; start_date: string; end_date?: string; notes?: string;
}) {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("recurring_transactions")
        .insert({ ...rec, user_id: userId, is_active: true })
        .select("*, category:categories(*)")
        .single();
    if (error) throw error;
    return data;
}

export async function updateRecurringTransaction(id: string, rec: {
    name: string; type: "income" | "expense"; amount: number;
    category_id?: string; payment_method: string; frequency: "monthly" | "weekly";
    day_of_period: number; start_date: string; end_date?: string; notes?: string;
}) {
    const { supabase } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("recurring_transactions")
        .update({ ...rec, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*, category:categories(*)")
        .single();
    if (error) throw error;
    return data;
}

export async function toggleRecurringActive(id: string, isActive: boolean) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase
        .from("recurring_transactions")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) throw error;
}

export async function deleteRecurringTransaction(id: string) {
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
    if (error) throw error;
}

// ─── Forecast defaults from real transaction history ─────────────────────────
// Averages income/expense over the last 3 months so the forecast page can
// start from numbers that reflect actual spending habits, instead of
// hardcoded placeholder values.
export async function getForecastDefaults() {
    const { supabase, userId } = await getSupabaseUser();

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const { data: txs } = await supabase
        .from("transactions")
        .select("type, amount, date")
        .eq("user_id", userId)
        .gte("date", threeMonthsAgo)
        .lte("date", lastDay);

    const transactions = txs ?? [];

    // Group by year-month to average across however many months have data
    const monthKeys = new Set(transactions.map((t) => t.date.slice(0, 7)));
    const monthCount = Math.max(1, monthKeys.size);

    const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const totalDebtPayment = transactions.filter((t) => t.type === "debt_payment").reduce((s, t) => s + Number(t.amount), 0);

    const avgIncome = Math.round(totalIncome / monthCount);
    const avgExpense = Math.round(totalExpense / monthCount);
    const avgDebtPayment = Math.round(totalDebtPayment / monthCount);

    // Suggest a savings allocation as whatever's left after expenses + debt payment,
    // floored at 0 so we never suggest a negative number.
    const suggestedSavings = Math.max(0, avgIncome - avgExpense - avgDebtPayment);

    return {
        monthly_income: avgIncome,
        fixed_expenses: avgExpense,
        debt_allocation: avgDebtPayment,
        savings_allocation: suggestedSavings,
        hasHistoricalData: transactions.length > 0,
    };
}

// ─── Debt trend (6 months) based on real payment history ─────────────────────
// Walks backward from today's total remaining debt, adding back each month's
// debt_payment transactions, so the trend line reflects actual repayment
// history instead of a flat/fake line.
export async function getDebtTrendData() {
    const { supabase, userId } = await getSupabaseUser();

    const [debtRes, txRes] = await Promise.all([
        supabase.from("debts").select("remaining, status").eq("user_id", userId),
        supabase.from("transactions").select("amount, date")
            .eq("user_id", userId).eq("type", "debt_payment"),
    ]);

    const currentTotalRemaining = (debtRes.data ?? [])
        .filter((d) => d.status === "active")
        .reduce((s, d) => s + Number(d.remaining), 0);

    const payments = txRes.data ?? [];

    const months: { month: string; total: number }[] = [];
    let runningRemaining = currentTotalRemaining;

    // Build last 6 months, starting from current month going backward,
    // then reverse so chart reads left-to-right chronologically.
    const tempMonths: { key: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        tempMonths.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            label: d.toLocaleString("id-ID", { month: "short" }),
        });
    }

    for (const { key, label } of tempMonths) {
        months.push({ month: label, total: Math.max(0, runningRemaining) });
        // Add back this month's payments to reconstruct what the balance was
        // before this month's payments were made.
        const paidThisMonth = payments
            .filter((p) => p.date.slice(0, 7) === key)
            .reduce((s, p) => s + Number(p.amount), 0);
        runningRemaining += paidThisMonth;
    }

    return months.reverse();
}

// ─── Receivables (Piutang) ────────────────────────────────────────────────────
export async function getReceivables() {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("receivables")
        .select("*, account:accounts(*)")
        .eq("user_id", userId)
        .order("due_date", { ascending: true });
    if (error) throw error;
    return data;
}

export async function addReceivable(recv: {
    name: string; borrower: string; total_amount: number;
    start_date: string; due_date: string; priority: string; notes?: string;
    account_id: string;
}) {
    const { supabase, userId } = await getSupabaseUser();

    // Piutang keluar = uang beneran ninggalin salah satu akun kita. Dicatat
    // sebagai transaksi "receivable_out" (bukan "expense") — pola yang sama
    // kayak debt_payment: ngurangin saldo akun & kehitung cash-out bulanan,
    // tapi TIDAK ikut breakdown kategori pengeluaran.
    const tx = await addTransaction({
        type: "receivable_out",
        name: `Piutang: ${recv.name}`,
        description: `Dipinjamkan ke ${recv.borrower}`,
        amount: recv.total_amount,
        date: recv.start_date,
        payment_method: "transfer",
        status: "completed",
        account_id: recv.account_id,
    });

    const { data, error } = await supabase
        .from("receivables")
        .insert({ ...recv, user_id: userId, total_received: 0, status: "active", transaction_id: tx.id })
        .select("*, account:accounts(*)")
        .single();
    if (error) throw error;
    return data;
}

export async function recordReceivablePayment(receivableId: string, amount: number, accountId: string, notes?: string) {
    const { supabase } = await getSupabaseUser();
    // Get current data
    const { data: recv, error: fetchErr } = await supabase
        .from("receivables")
        .select("*")
        .eq("id", receivableId)
        .single();
    if (fetchErr) throw fetchErr;

    const newReceived = Number(recv.total_received) + amount;
    const newRemaining = Math.max(0, Number(recv.total_amount) - newReceived);
    const newStatus = newRemaining === 0 ? "completed" : recv.status;

    const { data, error } = await supabase
        .from("receivables")
        .update({ total_received: newReceived, status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", receivableId)
        .select("*, account:accounts(*)")
        .single();
    if (error) throw error;

    const today = new Date().toISOString().split("T")[0];

    // Auto-create income transaction lewat addTransaction (bukan insert
    // manual) supaya account_id ke-set & saldo akun penerima ke-update
    // konsisten dengan alur transaksi lainnya.
    const tx = await addTransaction({
        type: "income",
        name: `Piutang Diterima: ${recv.name}`,
        description: notes || `Pembayaran piutang dari ${recv.borrower}`,
        amount,
        date: today,
        payment_method: "transfer",
        status: "completed",
        account_id: accountId,
    });

    // Log payment
    await supabase.from("receivable_payments").insert({
        receivable_id: receivableId,
        amount,
        date: today,
        notes,
        account_id: accountId,
        transaction_id: tx.id,
    });

    return data;
}

export async function deleteReceivable(id: string) {
    const { supabase } = await getSupabaseUser();
    // Catatan: transaksi "receivable_out" & "income" yang udah kebentuk dari
    // piutang ini TIDAK ikut kehapus — uang emang beneran udah pindah di
    // masa lalu, jadi riwayat kas di akun tetap harus akurat walau catatan
    // piutangnya dihapus.
    const { error } = await supabase.from("receivables").delete().eq("id", id);
    if (error) throw error;
}

export async function updateReceivable(id: string, recv: {
    name: string; borrower: string; total_amount: number;
    start_date: string; due_date: string; priority: string; notes?: string;
    account_id?: string;
}) {
    const { supabase } = await getSupabaseUser();

    // Ambil data lama dulu buat tau apa yang berubah & buat validasi.
    const { data: existing, error: fetchErr } = await supabase
        .from("receivables")
        .select("*")
        .eq("id", id)
        .single();
    if (fetchErr) throw fetchErr;

    // Nominal gak boleh diturunin di bawah yang udah kebayar — bakal bikin
    // total_received > total_amount (piutang "lunas lebih").
    if (recv.total_amount < Number(existing.total_received)) {
        throw new Error(
            `Nominal gak boleh kurang dari Rp${Number(existing.total_received).toLocaleString("id-ID")} yang udah diterima`
        );
    }

    const { data, error } = await supabase
        .from("receivables")
        .update({ ...recv, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*, account:accounts(*)")
        .single();
    if (error) throw error;

    // Auto-sync transaksi "receivable_out" yang nempel, kalau nominal, akun,
    // atau tanggalnya berubah — biar saldo akun & catatan piutang tetap
    // konsisten satu sama lain.
    if (existing.transaction_id) {
        const amountChanged = Number(recv.total_amount) !== Number(existing.total_amount);
        const accountChanged = !!recv.account_id && recv.account_id !== existing.account_id;
        const dateChanged = recv.start_date !== existing.start_date;
        const nameChanged = recv.name !== existing.name || recv.borrower !== existing.borrower;

        if (amountChanged || accountChanged || dateChanged || nameChanged) {
            await updateTransaction(existing.transaction_id, {
                amount: recv.total_amount,
                account_id: recv.account_id,
                date: recv.start_date,
                name: `Piutang: ${recv.name}`,
                description: `Dipinjamkan ke ${recv.borrower}`,
            });
        }
    }

    return data as Receivable;
}

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

// ─── Notifications ──────────────────────────────────────────────────────────
// Catatan: notif "jatuh tempo utang" idealnya di-generate harian oleh cron job
// (supabase/functions/check-due-reminders) dan disimpan di tabel `notifications`.
// Tapi supaya user tetap lihat alert-nya walau cron belum/belum sempat jalan
// hari itu, di sini kita juga hitung "live alert" langsung dari tabel `debts`
// setiap kali fungsi ini dipanggil, lalu di-merge (dan di-dedupe) dengan yang
// sudah persisted di DB.
// ─── Notification Preferences ──────────────────────────────────────────────
export interface NotificationPreferences {
    debt_due: boolean;
    goal_reminder: boolean;
    recurring_bill: boolean;
    wishlist_update: boolean;
    health_score_weekly: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
    debt_due: true,
    goal_reminder: true,
    recurring_bill: false,
    wishlist_update: false,
    health_score_weekly: true,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
    const { supabase, userId } = await getSupabaseUser();
    const { data, error } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", userId)
        .single();
    if (error) throw error;
    return { ...DEFAULT_NOTIF_PREFS, ...(data?.notification_preferences ?? {}) };
}

export async function updateNotificationPreferences(prefs: Partial<NotificationPreferences>) {
    const { supabase, userId } = await getSupabaseUser();
    const current = await getNotificationPreferences();
    const updated = { ...current, ...prefs };

    const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: updated })
        .eq("id", userId);
    if (error) throw error;
    return updated;
}

export async function getNotifications(): Promise<Notification[]> {
    const { supabase, userId } = await getSupabaseUser();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    const [{ data: stored, error: storedError }, { data: debts, error: debtsError }, prefs] = await Promise.all([
        supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20),
        supabase
            .from("debts")
            .select("id, name, due_date, next_due_date, is_installment, remaining")
            .eq("user_id", userId)
            .eq("status", "active"),
        getNotificationPreferences(),
    ]);
    if (storedError) throw storedError;
    if (debtsError) throw debtsError;

    // User matiin toggle "Jatuh tempo utang" — jangan tampilin debt_due sama
    // sekali, baik yang udah persisted (dari cron) maupun yang live-generated.
    const debtDueEnabled = prefs.debt_due;

    const storedNotifs = ((stored ?? []) as Notification[])
        .filter((n) => debtDueEnabled || n.type !== "debt_due");

    // Kalau cron sudah pernah insert notif debt_due untuk debt ini hari ini,
    // jangan tampilkan versi "live" lagi biar gak dobel.
    const alreadyNotifiedToday = new Set(
        storedNotifs
            .filter((n) => n.type === "debt_due" && n.reference_id && new Date(n.created_at) >= today)
            .map((n) => n.reference_id)
    );

    const liveNotifs: Notification[] = !debtDueEnabled ? [] : (debts ?? [])
        .map((d): Notification | null => {
            const dueStr = d.is_installment && d.next_due_date ? d.next_due_date : d.due_date;
            if (!dueStr || alreadyNotifiedToday.has(d.id)) return null;

            const due = new Date(dueStr);
            if (due > in7Days) return null;

            const daysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const whenText =
                daysLeft < 0 ? `terlambat ${Math.abs(daysLeft)} hari`
                    : daysLeft === 0 ? "jatuh tempo hari ini"
                        : `jatuh tempo dalam ${daysLeft} hari`;

            return {
                id: `live-debt-${d.id}`,
                user_id: userId,
                type: "debt_due",
                title: "Jatuh Tempo Utang",
                message: `${d.name} ${whenText}. Sisa Rp ${Number(d.remaining).toLocaleString("id-ID")}.`,
                is_read: false,
                reference_id: d.id,
                reference_type: "debt",
                created_at: new Date().toISOString(),
            };
        })
        .filter((n): n is Notification => n !== null);

    return [...liveNotifs, ...storedNotifs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export async function markNotificationRead(id: string) {
    // Notif "live" (id-nya "live-debt-...") gak ada row-nya di DB, jadi gak perlu di-update.
    if (id.startsWith("live-debt-")) return;
    const { supabase } = await getSupabaseUser();
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) throw error;
}

export async function markAllNotificationsRead() {
    const { supabase, userId } = await getSupabaseUser();
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
    if (error) throw error;
}

// Live-listen utk row baru di tabel `notifications` (butuh realtime
// di-enable di Supabase: `alter publication supabase_realtime add table public.notifications;`).
// Return fungsi untuk unsubscribe — wajib dipanggil di cleanup useEffect.
export async function subscribeToNotifications(
    onInsert: (notif: Notification) => void
): Promise<() => void> {
    const { supabase, userId } = await getSupabaseUser();

    const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
            (payload) => onInsert(payload.new as Notification)
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

// ─── Category breakdown (bulan ini, FULL — bukan dari 10 transaksi terakhir) ──
// Dashboard sebelumnya bikin pie chart kategori dari `getTransactions({limit:10})`
// (query yang sebenarnya buat list "Transaksi Terakhir"), jadi misleading kalau
// user punya >10 transaksi sebulan. Ini query langsung semua expense bulan ini.
export async function getCategoryBreakdown(year?: number, month?: number, accountId?: string): Promise<{ name: string; value: number }[]> {
    const { supabase, userId } = await getSupabaseUser();

    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth();
    const firstDay = new Date(y, m, 1).toISOString().split("T")[0];
    const lastDay = new Date(y, m + 1, 0).toISOString().split("T")[0];

    let query = supabase
        .from("transactions")
        .select("amount, category:categories(name)")
        .eq("user_id", userId)
        .eq("type", "expense")
        .gte("date", firstDay)
        .lte("date", lastDay);
    if (accountId) query = query.eq("account_id", accountId);

    const { data, error } = await query;
    if (error) throw error;

    const map: Record<string, number> = {};
    ((data ?? []) as any[]).forEach((t) => {
        const cat = t.category?.name ?? "Lainnya";
        map[cat] = (map[cat] ?? 0) + Number(t.amount);
    });

    return Object.entries(map).map(([name, value]) => ({ name, value }));
}

// Breakdown pengeluaran (type = "expense") per akun, buat satu bulan tertentu.
// Dipakai di halaman Laporan biar keliatan dari akun mana aja uang paling
// banyak kepake di bulan itu.
export async function getExpenseByAccount(year?: number, month?: number): Promise<{ account_id: string | null; name: string; color: string | null; value: number }[]> {
    const { supabase, userId } = await getSupabaseUser();

    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth();
    const firstDay = new Date(y, m, 1).toISOString().split("T")[0];
    const lastDay = new Date(y, m + 1, 0).toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("transactions")
        .select("amount, account_id, account:accounts!transactions_account_id_fkey(name, color)")
        .eq("user_id", userId)
        .eq("type", "expense")
        .gte("date", firstDay)
        .lte("date", lastDay);
    if (error) throw error;

    const map: Record<string, { name: string; color: string | null; value: number }> = {};
    ((data ?? []) as any[]).forEach((t) => {
        const key = t.account_id ?? "none";
        const name = t.account?.name ?? "Tanpa Akun";
        const color = t.account?.color ?? null;
        if (!map[key]) map[key] = { name, color, value: 0 };
        map[key].value += Number(t.amount);
    });

    return Object.entries(map)
        .map(([account_id, v]) => ({ account_id: account_id === "none" ? null : account_id, ...v }))
        .sort((a, b) => b.value - a.value);
}

// ─── Global Search ──────────────────────────────────────────────────────────
export interface SearchResult {
    id: string;
    type: "debt" | "transaction" | "goal" | "wishlist" | "receivable" | "account";
    title: string;
    subtitle: string;
    href: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const { supabase, userId } = await getSupabaseUser();
    const like = `%${q}%`;

    const [debts, transactions, goals, wishlist, receivables, accounts] = await Promise.all([
        supabase.from("debts").select("id, name, lender").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("transactions").select("id, name, amount").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("goals").select("id, name, target_amount").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("wishlists").select("id, name, price").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("receivables").select("id, name, borrower, total_amount").eq("user_id", userId).ilike("name", like).limit(5),
        supabase.from("accounts").select("id, name, type, initial_balance").eq("user_id", userId).ilike("name", like).limit(5),
    ]);

    const results: SearchResult[] = [];

    (debts.data ?? []).forEach((d) =>
        results.push({ id: d.id, type: "debt", title: d.name, subtitle: `Utang • ${d.lender}`, href: "/debts" })
    );
    (transactions.data ?? []).forEach((t) =>
        results.push({
            id: t.id, type: "transaction", title: t.name,
            subtitle: `Transaksi • Rp ${Number(t.amount).toLocaleString("id-ID")}`, href: "/transactions",
        })
    );
    (goals.data ?? []).forEach((g) =>
        results.push({
            id: g.id, type: "goal", title: g.name,
            subtitle: `Tujuan • Rp ${Number(g.target_amount).toLocaleString("id-ID")}`, href: "/goals",
        })
    );
    (wishlist.data ?? []).forEach((w) =>
        results.push({
            id: w.id, type: "wishlist", title: w.name,
            subtitle: `Wishlist • Rp ${Number(w.price).toLocaleString("id-ID")}`, href: "/wishlist",
        })
    );
    (receivables.data ?? []).forEach((r) =>
        results.push({ id: r.id, type: "receivable", title: r.name, subtitle: `Piutang • ${r.borrower}`, href: "/receivables" })
    );
    (accounts.data ?? []).forEach((a) =>
        results.push({ id: a.id, type: "account", title: a.name, subtitle: `Akun • ${a.type}`, href: "/accounts" })
    );

    return results;
}