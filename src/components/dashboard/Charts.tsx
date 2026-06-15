"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { formatCurrency } from "@/utils";
import type { MonthlyChartData, CategoryChartData } from "@/types";

const CHART_COLORS = {
  income: "#22C55E",
  expense: "#EF4444",
  balance: "#94A3B8",
  debt: "#F59E0B",
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-card border border-border rounded-lg px-3 py-2.5 shadow-xl">
      <p className="text-xs text-text-secondary mb-1.5 font-medium">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="text-text-primary font-medium font-mono-data">
            {formatCurrency(entry.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Income vs Expense Chart ──────────────────────────────────────────────────
export function IncomeExpenseChart({ data }: { data: MonthlyChartData[] }) {
  return (
    <div className="card-base p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Income vs Expense</h3>
          <p className="text-xs text-text-secondary mt-0.5">6 bulan terakhir</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            Pemasukan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger" />
            Pengeluaran
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v, true)}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="income" name="Pemasukan" fill={CHART_COLORS.income} radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" name="Pengeluaran" fill={CHART_COLORS.expense} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Balance Trend Chart ──────────────────────────────────────────────────────
export function BalanceTrendChart({ data }: { data: MonthlyChartData[] }) {
  return (
    <div className="card-base p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Trend Saldo</h3>
        <p className="text-xs text-text-secondary mt-0.5">Pertumbuhan saldo 6 bulan</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v, true)}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="balance"
            name="Saldo"
            stroke={CHART_COLORS.balance}
            strokeWidth={2}
            fill="url(#balanceGrad)"
            dot={{ fill: "#94A3B8", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#F8FAFC" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Debt Trend Chart ─────────────────────────────────────────────────────────
export function DebtTrendChart({ data }: { data: { month: string; total: number }[] }) {
  return (
    <div className="card-base p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Trend Utang</h3>
        <p className="text-xs text-text-secondary mt-0.5">Progres pelunasan utang</p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v, true)}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="total"
            name="Total Utang"
            stroke={CHART_COLORS.debt}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.debt, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#F8FAFC" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Category Pie Chart ───────────────────────────────────────────────────────
const PIE_COLORS = ["#64748B", "#475569", "#94A3B8", "#334155", "#1E293B", "#273449"];

export function CategoryPieChart({ data }: { data: CategoryChartData[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card-base p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Distribusi Pengeluaran</h3>
        <p className="text-xs text-text-secondary mt-0.5">Bulan ini per kategori</p>
      </div>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={62}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [formatCurrency(v), ""]}
              contentStyle={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 8 }}
              labelStyle={{ color: "#94A3B8" }}
              itemStyle={{ color: "#F8FAFC" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="text-xs text-text-secondary truncate">{item.name}</span>
              </div>
              <span className="text-xs font-medium text-text-primary tabular-nums shrink-0">
                {Math.round((item.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
