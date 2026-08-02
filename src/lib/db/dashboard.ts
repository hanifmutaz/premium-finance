import { getSupabaseUser } from "./client";
import { ACTIVE_DEBT_STATUSES } from "@/utils";
import type { Debt } from "@/types";
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
        supabase.from("debts").select("*").eq("user_id", userId).in("status", ACTIVE_DEBT_STATUSES),
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