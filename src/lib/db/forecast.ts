import { getSupabaseUser } from "./client";

// ─── Forecast defaults from real transaction history ─────────────────────────
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

