"use client";

import { useEffect, useState } from "react";
import { DashboardStatCards } from "@/components/dashboard/StatCards";
import { IncomeExpenseChart, BalanceTrendChart, DebtTrendChart, CategoryPieChart } from "@/components/dashboard/Charts";
import { DebtOverviewWidget } from "@/components/dashboard/DebtOverview";
import { FinancialGoalsWidget } from "@/components/dashboard/FinancialGoals";
import { SavingsOverviewWidget } from "@/components/dashboard/SavingsOverview";
import { HealthScoreWidget } from "@/components/dashboard/HealthScore";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { StatCardSkeleton } from "@/components/shared/Skeleton";
import { getDashboardStats, getMonthlyChartData, getDebts, getGoals, getTransactions, getDebtTrendData, getCategoryBreakdown, getSavingsOverview } from "@/lib/db";
import { calculateHealthScore } from "@/lib/calculations";
import type { DashboardStats, MonthlyChartData, Debt, Goal, Transaction } from "@/types";
import type { SavingsOverview } from "@/lib/db";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyChartData[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debtTrend, setDebtTrend] = useState<{ month: string; total: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [savings, setSavings] = useState<SavingsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, m, d, g, t, dt, cb, sv] = await Promise.all([
          getDashboardStats(),
          getMonthlyChartData(),
          getDebts(),
          getGoals(),
          getTransactions({ limit: 10 }),
          getDebtTrendData(),
          getCategoryBreakdown(),
          getSavingsOverview(),
        ]);

        // Calculate health score
        const healthScore = calculateHealthScore({
          monthlyIncome: s.monthly_income,
          monthlyExpense: s.monthly_expense,
          totalDebt: s.total_active_debt,
          monthlySavings: Math.max(0, s.monthly_income - s.monthly_expense),
          goals: g,
        });

        setStats({ ...s, health_score: healthScore });
        setMonthlyData(m);
        setDebts(d);
        setGoals(g);
        setTransactions(t);
        setDebtTrend(dt);
        setCategoryData(cb.map((c) => ({ ...c, color: "#64748B" })));
        setSavings(sv);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card-base h-64 animate-pulse bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Debt trend & category breakdown sekarang dari getDebtTrendData() / getCategoryBreakdown()
  // (data real, bukan diturunkan dari array transaksi yang udah di-limit 10).

  return (
    <div className="space-y-5">
      <DashboardStatCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IncomeExpenseChart data={monthlyData} />
        <BalanceTrendChart data={monthlyData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DebtOverviewWidget debts={debts} />
        <FinancialGoalsWidget goals={goals} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <div>
          {stats.health_score && <HealthScoreWidget score={stats.health_score} />}
        </div>
        <div>
          <DebtTrendChart data={debtTrend} />
        </div>
        <div>
          {categoryData.length > 0
            ? <CategoryPieChart data={categoryData} />
            : (
              <div className="card-base p-5 flex items-center justify-center h-full min-h-[200px]">
                <p className="text-text-secondary text-sm">Belum ada data pengeluaran</p>
              </div>
            )
          }
        </div>
        <div>
          {savings && <SavingsOverviewWidget data={savings} />}
        </div>
      </div>

      <RecentTransactions transactions={transactions} />
    </div>
  );
}