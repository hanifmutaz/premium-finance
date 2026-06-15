import { DashboardStatCards } from "@/components/dashboard/StatCards";
import { IncomeExpenseChart, BalanceTrendChart, DebtTrendChart, CategoryPieChart } from "@/components/dashboard/Charts";
import { DebtOverviewWidget } from "@/components/dashboard/DebtOverview";
import { FinancialGoalsWidget } from "@/components/dashboard/FinancialGoals";
import { HealthScoreWidget } from "@/components/dashboard/HealthScore";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import {
  mockDashboardStats,
  mockMonthlyData,
  mockCategoryData,
  mockDebtTrend,
  mockDebts,
  mockGoals,
  mockTransactions,
} from "@/lib/mock-data";

export default function DashboardPage() {
  const stats = mockDashboardStats;

  return (
    <div className="space-y-5">
      {/* ── Stat Cards ── */}
      <DashboardStatCards stats={stats} />

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IncomeExpenseChart data={mockMonthlyData} />
        <BalanceTrendChart data={mockMonthlyData} />
      </div>

      {/* ── Debt + Goals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DebtOverviewWidget debts={mockDebts} />
        <FinancialGoalsWidget goals={mockGoals} />
      </div>

      {/* ── Health + Debt Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <HealthScoreWidget score={stats.health_score!} />
        </div>
        <div className="lg:col-span-1">
          <DebtTrendChart data={mockDebtTrend} />
        </div>
        <div className="lg:col-span-1">
          <CategoryPieChart data={mockCategoryData} />
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <RecentTransactions transactions={mockTransactions} />
    </div>
  );
}
