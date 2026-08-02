import { getSupabaseUser } from "./client";
import type { Debt } from "@/types";

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


// ─── Debt Freedom Dashboard ────────────────────────────────────────────────────
// Ringkasan progres bebas-utang: total awal, sisa, % lunas, dan estimasi kapan
// bebas berdasarkan RATA-RATA pembayaran 3 bulan terakhir (bukan cuma bulan ini
// — biar gak kejebak sama bulan yang kebetulan sepi/rame). Simulasi "nambah
// bayar" dihitung di komponen (client-side), gak perlu round-trip lagi ke sini
// tiap slider digeser — cukup avgMonthlyPayment yang dikirim balik.
export interface DebtFreedomStats {
    totalInitial: number;      // Total total_amount dari SEMUA utang (aktif + lunas)
    totalRemaining: number;    // Sisa utang aktif saat ini
    totalPaidAllTime: number;  // totalInitial - totalRemaining
    percentPaid: number;       // 0-100
    avgMonthlyPayment: number; // Rata-rata pembayaran/bulan, 3 bulan penuh terakhir
    avgMonthlyPaymentSource: "history" | "installment_fallback" | "none";
}

export async function getDebtFreedomStats(): Promise<DebtFreedomStats> {
    const { supabase, userId } = await getSupabaseUser();

    const [debtsRes, txRes] = await Promise.all([
        supabase.from("debts").select("total_amount, total_paid, remaining, status, is_installment, installment_amount"),
        supabase.from("transactions").select("amount, date")
            .eq("user_id", userId).eq("type", "debt_payment"),
    ]);
    if (debtsRes.error) throw debtsRes.error;
    if (txRes.error) throw txRes.error;

    const debts = debtsRes.data ?? [];
    const payments = txRes.data ?? [];

    const totalInitial = debts.reduce((s, d) => s + Number(d.total_amount), 0);
    // "Aktif" di sini = active + overdue, samain sama definisi di halaman
    // /debts (lihat `active` di debts/page.tsx) — utang telat tetep punya
    // sisa yang harus dibayar, jangan sampai ke-skip dari total.
    const totalRemaining = debts
        .filter((d) => d.status === "active" || d.status === "overdue")
        .reduce((s, d) => s + Number(d.remaining), 0);
    const totalPaidAllTime = Math.max(0, totalInitial - totalRemaining);
    const percentPaid = totalInitial > 0 ? Math.min(100, (totalPaidAllTime / totalInitial) * 100) : 0;

    // Rata-rata pembayaran per bulan: 3 bulan KALENDER PENUH terakhir (gak
    // termasuk bulan berjalan — masih parsial, bakal bikin pace keliatan
    // lebih lambat dari aslinya kalau ikut dihitung).
    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const totalLast3Months = payments
        .filter((p) => monthKeys.includes(p.date.slice(0, 7)))
        .reduce((s, p) => s + Number(p.amount), 0);

    let avgMonthlyPayment = totalLast3Months / 3;
    let avgMonthlyPaymentSource: DebtFreedomStats["avgMonthlyPaymentSource"] = "history";

    // Fallback: histori 3 bulan kosong (user baru mulai / belum ada
    // pembayaran tercatat) — pakai total cicilan wajib bulanan yang aktif
    // sebagai estimasi minimum pace, lebih masuk akal daripada 0.
    if (avgMonthlyPayment <= 0) {
        const installmentTotal = debts
            .filter((d) => (d.status === "active" || d.status === "overdue") && d.is_installment)
            .reduce((s, d) => s + Number(d.installment_amount ?? 0), 0);
        if (installmentTotal > 0) {
            avgMonthlyPayment = installmentTotal;
            avgMonthlyPaymentSource = "installment_fallback";
        } else {
            avgMonthlyPaymentSource = "none";
        }
    }

    return { totalInitial, totalRemaining, totalPaidAllTime, percentPaid, avgMonthlyPayment, avgMonthlyPaymentSource };
}
export async function getDebtTrendData() {
    const { supabase, userId } = await getSupabaseUser();

    const [debtRes, txRes] = await Promise.all([
        supabase.from("debts").select("remaining, status").eq("user_id", userId),
        supabase.from("transactions").select("amount, date")
            .eq("user_id", userId).eq("type", "debt_payment"),
    ]);

    const currentTotalRemaining = (debtRes.data ?? [])
        .filter((d) => d.status === "active" || d.status === "overdue")
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