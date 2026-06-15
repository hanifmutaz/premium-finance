"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Download, FileText, FileSpreadsheet, FileDown } from "lucide-react";
import { formatCurrency, cn } from "@/utils";
import { mockMonthlyData, mockCategoryData, mockTransactions } from "@/lib/mock-data";

const PERIOD_TABS = ["Bulanan", "Mingguan", "Tahunan"] as const;
const PIE_COLORS = ["#64748B", "#475569", "#94A3B8", "#334155", "#1E293B", "#273449"];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-text-secondary mb-1">{label}</p>
      {payload.map((e: any) => (
        <div key={e.dataKey} className="flex gap-2 items-center">
          <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
          <span className="text-text-primary tabular-nums">{formatCurrency(e.value, true)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<typeof PERIOD_TABS[number]>("Bulanan");

  const income = mockTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = mockTransactions
    .filter((t) => t.type !== "income")
    .reduce((s, t) => s + t.amount, 0);
  const net = income - expense;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Laporan Keuangan</h1>
          <p className="text-sm text-text-secondary mt-0.5">Ringkasan aktivitas finansial</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors">
            <FileDown size={13} /> PDF
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors">
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors">
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 border-b border-border">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setPeriod(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              period === tab
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Pemasukan</p>
          <p className="text-2xl font-semibold text-success tabular-nums">{formatCurrency(income, true)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Pengeluaran</p>
          <p className="text-2xl font-semibold text-danger tabular-nums">{formatCurrency(expense, true)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Net Cash Flow</p>
          <p className={cn("text-2xl font-semibold tabular-nums", net >= 0 ? "text-success" : "text-danger")}>
            {net >= 0 ? "+" : ""}{formatCurrency(net, true)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income vs Expense */}
        <div className="card-base p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Income vs Expense</h3>
          <p className="text-xs text-text-secondary mb-4">6 bulan terakhir</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockMonthlyData} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, true)} width={64} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="income" name="Pemasukan" fill="#22C55E" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        <div className="card-base p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Distribusi Pengeluaran</h3>
          <p className="text-xs text-text-secondary mb-4">Per kategori bulan ini</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={mockCategoryData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={2} dataKey="value">
                  {mockCategoryData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {mockCategoryData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-text-secondary">{item.name}</span>
                  </div>
                  <span className="text-xs text-text-primary font-medium tabular-nums">
                    {formatCurrency(item.value, true)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction list summary */}
      <div className="card-base">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Detail Transaksi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Tanggal", "Nama", "Kategori", "Metode", "Nominal"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] text-accent uppercase tracking-widest font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-surface/30 transition-colors">
                  <td className="px-5 py-3 text-xs text-text-secondary tabular-nums whitespace-nowrap">
                    {tx.date}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-primary">{tx.name}</td>
                  <td className="px-5 py-3 text-xs text-text-secondary">{tx.category?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-xs text-text-secondary capitalize">
                    {tx.payment_method.replace("_", " ")}
                  </td>
                  <td className={cn(
                    "px-5 py-3 text-sm font-semibold tabular-nums text-right",
                    tx.type === "income" ? "text-success" : "text-text-primary"
                  )}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
