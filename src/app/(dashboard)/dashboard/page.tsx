"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardStatCards } from "@/components/dashboard/StatCards";
import { IncomeExpenseChart, BalanceTrendChart, DebtTrendChart, CategoryPieChart } from "@/components/dashboard/Charts";
import { DebtOverviewWidget } from "@/components/dashboard/DebtOverview";
import { FinancialGoalsWidget } from "@/components/dashboard/FinancialGoals";
import { SavingsOverviewWidget } from "@/components/dashboard/SavingsOverview";
import { HealthScoreWidget } from "@/components/dashboard/HealthScore";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { StatCardSkeleton } from "@/components/shared/Skeleton";
import { getDashboardStats, getMonthlyChartData, getDebts, getGoals, getTransactions, getDebtTrendData, getCategoryBreakdown, getSavingsOverview, getCumulativeSavings } from "@/lib/db";
import { calculateHealthScore } from "@/lib/calculations";
import type { DashboardStats, MonthlyChartData, Debt, Goal, Transaction } from "@/types";
import type { SavingsOverview } from "@/lib/db";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyChartData[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debtTrend, setDebtTrend] = useState<{ month: string; total: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [savings, setSavings] = useState<SavingsOverview | null>(null);
  const [cumulativeSavings, setCumulativeSavings] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const [s, mc, d, g, t, dt, cb, sv, cs] = await Promise.all([
        getDashboardStats(y, m),
        getMonthlyChartData(y, m),
        getDebts(),
        getGoals(),
        getTransactions({ limit: 10 }),
        getDebtTrendData(),
        getCategoryBreakdown(y, m),
        getSavingsOverview(),
        getCumulativeSavings(),
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
      setMonthlyData(mc);
      setDebts(d);
      setGoals(g);
      setTransactions(t);
      setDebtTrend(dt);
      setCategoryData(cb.map((c) => ({ ...c, color: "#64748B" })));
      setSavings(sv);
      setCumulativeSavings(cs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year, month); }, [load, year, month]);

  function goToCurrentMonth() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-input border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-input border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
          >
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {!isCurrentMonth && (
            <button
              onClick={goToCurrentMonth}
              className="text-xs text-accent hover:text-text-primary transition-colors px-2 py-1"
            >
              Kembali ke bulan ini
            </button>
          )}
        </div>
        {!isCurrentMonth && (
          <span className="text-xs text-warning bg-warning/10 px-2.5 py-1 rounded-md">
            Nampilin data {MONTH_NAMES[month]} {year} (backdate)
          </span>
        )}
      </div>

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
          {savings && <SavingsOverviewWidget data={savings} cumulative={cumulativeSavings} />}
        </div>
      </div>

      <RecentTransactions transactions={transactions} />
    </div>
  );
}