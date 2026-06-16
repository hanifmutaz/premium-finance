"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { DashboardStatCards } from "@/components/dashboard/StatCards";
import { IncomeExpenseChart, BalanceTrendChart, DebtTrendChart, CategoryPieChart } from "@/components/dashboard/Charts";
import { DebtOverviewWidget } from "@/components/dashboard/DebtOverview";
import { FinancialGoalsWidget } from "@/components/dashboard/FinancialGoals";
import { HealthScoreWidget } from "@/components/dashboard/HealthScore";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { StatCardSkeleton } from "@/components/shared/Skeleton";
import { getDashboardStats, getMonthlyChartData, getDebts, getGoals, getTransactions } from "@/lib/db";
import { calculateHealthScore } from "@/lib/calculations";
import type { DashboardStats, MonthlyChartData, Debt, Goal, Transaction } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyChartData[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, m, d, g, t] = await Promise.all([
          getDashboardStats(),
          getMonthlyChartData(),
          getDebts(),
          getGoals(),
          getTransactions({ limit: 10 }),
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

  // Debt trend dari debts
  const debtTrend = debts.slice(0, 6).map((_, i) => ({
    month: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"][i] ?? "—",
    total: stats.total_active_debt,
  }));

  // Category data dari transactions
  const categoryMap: Record<string, number> = {};
  transactions.filter((t) => t.type === "expense").forEach((t) => {
    const cat = t.category?.name ?? "Lainnya";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + t.amount;
  });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({
    name, value, color: "#64748B",
  }));

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          {stats.health_score && <HealthScoreWidget score={stats.health_score} />}
        </div>
        <div className="lg:col-span-1">
          <DebtTrendChart data={debtTrend} />
        </div>
        <div className="lg:col-span-1">
          {categoryData.length > 0
            ? <CategoryPieChart data={categoryData} />
            : (
              <div className="card-base p-5 flex items-center justify-center h-full min-h-[200px]">
                <p className="text-text-secondary text-sm">Belum ada data pengeluaran</p>
              </div>
            )
          }
        </div>
      </div>

      <RecentTransactions transactions={transactions} />
    </div>
  );
}
