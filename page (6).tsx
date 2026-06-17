import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CreditCard,
  Calendar,
} from "lucide-react";
import { formatCurrency, formatPercent, cn } from "@/utils";
import type { DashboardStats } from "@/types";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive?: boolean };
}

function StatCard({ label, value, sub, subColor, icon, trend }: StatCardProps) {
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">{label}</p>
        <span className="text-accent group-hover:text-text-secondary transition-colors">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-semibold text-text-primary tabular-nums">{value}</p>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium mb-0.5 flex items-center gap-0.5",
              trend.positive ? "text-success" : "text-danger"
            )}
          >
            {trend.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {formatPercent(Math.abs(trend.value))}
          </span>
        )}
      </div>
      {sub && (
        <p className={cn("text-xs", subColor ?? "text-text-secondary")}>{sub}</p>
      )}
    </div>
  );
}

export function DashboardStatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <StatCard
        label="Pemasukan Bulan Ini"
        value={formatCurrency(stats.monthly_income, true)}
        sub="+8.2% dari bulan lalu"
        subColor="text-success"
        icon={<TrendingUp size={16} />}
        trend={{ value: 8.2, positive: true }}
      />
      <StatCard
        label="Pengeluaran Bulan Ini"
        value={formatCurrency(stats.monthly_expense, true)}
        sub="-3.5% dari bulan lalu"
        subColor="text-success"
        icon={<TrendingDown size={16} />}
        trend={{ value: 3.5, positive: false }}
      />
      <StatCard
        label="Sisa Dana"
        value={formatCurrency(stats.monthly_remaining, true)}
        sub="Net Savings"
        icon={<PiggyBank size={16} />}
      />
      <StatCard
        label="Total Utang Aktif"
        value={formatCurrency(stats.total_active_debt, true)}
        sub="Total Liabilities"
        icon={<CreditCard size={16} />}
      />
    </div>
  );
}
