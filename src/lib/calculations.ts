import type { Debt, Goal, Wishlist, ForecastInput, ForecastResult, FinancialScore } from "@/types";
import { scoreToGrade } from "@/utils";
import { addMonths, format } from "date-fns";

// ─── Debt Calculations ────────────────────────────────────────────────────────
export function calcDebtProgress(debt: Debt) {
  const percentage = debt.total_amount > 0 ? (debt.total_paid / debt.total_amount) * 100 : 0;
  const monthsRemaining = Math.ceil(debt.remaining / 875000); // avg payment
  const estimatedFinish = addMonths(new Date(), monthsRemaining);
  return {
    percentage: Math.min(percentage, 100),
    estimatedFinish: format(estimatedFinish, "MMM yyyy"),
    monthsRemaining,
  };
}

export function calcTotalDebt(debts: Debt[]) {
  return debts.filter((d) => d.status === "active").reduce((sum, d) => sum + d.remaining, 0);
}

// ─── Goal Calculations ────────────────────────────────────────────────────────
export function calcGoalProgress(goal: Goal) {
  const percentage = (goal.current_amount / goal.target_amount) * 100;
  const remaining = goal.target_amount - goal.current_amount;
  const deadlineDate = new Date(goal.deadline);
  const today = new Date();
  const monthsLeft = Math.max(
    1,
    (deadlineDate.getFullYear() - today.getFullYear()) * 12 +
      (deadlineDate.getMonth() - today.getMonth())
  );
  const monthlyNeeded = remaining / monthsLeft;
  const weeklyNeeded = monthlyNeeded / 4;
  const isOnTrack = percentage >= (100 - (monthsLeft / 12) * 100);

  return {
    percentage: Math.min(percentage, 100),
    remaining,
    monthlyNeeded,
    weeklyNeeded,
    monthsLeft,
    isOnTrack,
  };
}

// ─── Wishlist Calculations ────────────────────────────────────────────────────
export function calcWishlistProgress(
  item: Wishlist,
  monthlySurplus: number
) {
  const remaining = Math.max(0, item.price - item.saved_amount);
  const percentage = (item.saved_amount / item.price) * 100;
  const monthsNeeded = monthlySurplus > 0 ? Math.ceil(remaining / monthlySurplus) : Infinity;
  const estimatedDate = monthsNeeded < Infinity ? addMonths(new Date(), monthsNeeded) : null;
  const canBuy = item.saved_amount >= item.price;
  const recommendation = canBuy
    ? "Siap dibeli! Saldo sudah cukup."
    : monthsNeeded <= 3
    ? "Tunda dulu, hampir tercapai dalam waktu dekat."
    : "Tunda dan terus menabung secara konsisten.";

  return {
    remaining,
    percentage: Math.min(percentage, 100),
    monthsNeeded,
    estimatedDate: estimatedDate ? format(estimatedDate, "MMM yyyy") : "Tidak tentu",
    canBuy,
    recommendation,
  };
}

// ─── Forecast ─────────────────────────────────────────────────────────────────
export function generateForecast(
  input: ForecastInput,
  currentDebt: number,
  months = 12
): ForecastResult {
  const surplus = input.monthly_income - input.fixed_expenses - input.debt_allocation - input.savings_allocation;

  const simulate = (incomeMultiplier: number, expenseMultiplier: number) => {
    let balance = 0;
    let debt = currentDebt;
    const periods = [];

    for (let i = 1; i <= months; i++) {
      const income = input.monthly_income * incomeMultiplier;
      const expense = input.fixed_expenses * expenseMultiplier;
      const debtPayment = Math.min(input.debt_allocation, debt);
      debt = Math.max(0, debt - debtPayment);
      const monthSurplus = income - expense - debtPayment - input.savings_allocation;
      balance += monthSurplus;

      periods.push({
        month: format(addMonths(new Date(), i), "MMM yyyy"),
        balance: Math.round(balance),
        cumulative_savings: Math.round(input.savings_allocation * i),
        remaining_debt: Math.round(debt),
      });
    }
    return periods;
  };

  const normalCase = simulate(1, 1);
  const bestCase = simulate(1.15, 0.85);
  const worstCase = simulate(0.85, 1.15);

  // Find debt-free month
  const debtFreeIndex = normalCase.findIndex((p) => p.remaining_debt === 0);
  const debtFreeDate = debtFreeIndex >= 0 ? normalCase[debtFreeIndex].month : undefined;

  return {
    periods: normalCase,
    debt_free_date: debtFreeDate,
    best_case: bestCase,
    normal_case: normalCase,
    worst_case: worstCase,
  };
}

// ─── Financial Health Score ───────────────────────────────────────────────────
export function calculateHealthScore(params: {
  monthlyIncome: number;
  monthlyExpense: number;
  totalDebt: number;
  monthlySavings: number;
  goals: Goal[];
}): FinancialScore {
  const { monthlyIncome, monthlyExpense, totalDebt, monthlySavings, goals } = params;

  // Debt ratio: lower is better (target < 30%)
  const annualIncome = monthlyIncome * 12;
  const debtRatio = annualIncome > 0 ? (totalDebt / annualIncome) * 100 : 100;
  const debtScore = Math.max(0, 100 - debtRatio * 1.5);

  // Savings ratio: higher is better (target > 20%)
  const savingsRatio = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const savingsScore = Math.min(100, savingsRatio * 4);

  // Expense ratio: lower is better (target < 60%)
  const expenseRatio = monthlyIncome > 0 ? (monthlyExpense / monthlyIncome) * 100 : 100;
  const expenseScore = Math.max(0, 100 - expenseRatio);

  // Cashflow stability
  const cashflow = monthlyIncome - monthlyExpense;
  const cashflowStability = cashflow > 0 ? Math.min(100, (cashflow / monthlyIncome) * 200) : 0;

  // Target achievement
  const activeGoals = goals.filter((g) => g.status === "active");
  const avgProgress =
    activeGoals.length > 0
      ? activeGoals.reduce((sum, g) => sum + (g.current_amount / g.target_amount) * 100, 0) /
        activeGoals.length
      : 50;

  const totalScore = Math.round(
    debtScore * 0.25 +
      savingsScore * 0.25 +
      expenseScore * 0.2 +
      cashflowStability * 0.2 +
      avgProgress * 0.1
  );

  const grade = scoreToGrade(totalScore);
  const recommendations: string[] = [];

  if (debtRatio > 40) recommendations.push("Kurangi rasio utang di bawah 30% untuk kesehatan finansial optimal");
  if (savingsRatio < 20) recommendations.push("Tingkatkan tabungan ke minimal 20% dari pendapatan");
  if (expenseRatio > 70) recommendations.push("Pengeluaran terlalu tinggi, tinjau kembali pos pengeluaran");
  if (cashflow < 0) recommendations.push("Cashflow negatif! Segera evaluasi pengeluaran rutin");

  return {
    id: "calculated",
    user_id: "user-1",
    score: totalScore,
    grade,
    debt_ratio: Math.round(debtRatio),
    savings_ratio: Math.round(savingsRatio),
    expense_ratio: Math.round(expenseRatio),
    cashflow_stability: Math.round(cashflowStability),
    target_achievement: Math.round(avgProgress),
    recommendations,
    calculated_at: new Date().toISOString(),
  };
}
