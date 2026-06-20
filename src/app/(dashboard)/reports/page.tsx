"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { FileDown, FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { formatCurrency, cn } from "@/utils";
import { getTransactions, getMonthlyChartData } from "@/lib/db";
import { exportToExcel, exportToPDF, exportToCSV } from "@/lib/export";
import { toast } from "sonner";
import type { Transaction, MonthlyChartData } from "@/types";

const PERIOD_TABS = ["Bulanan", "Tahunan"] as const;
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
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "excel" | "csv" | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [txs, monthly] = await Promise.all([
          getTransactions({ limit: 500 }),
          getMonthlyChartData(),
        ]);
        setAllTransactions(txs);
        setMonthlyData(monthly);
      } catch { toast.error("Gagal memuat laporan"); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  // Filter transactions based on selected period (Bulanan = current month, Tahunan = current year)
  const transactions = useMemo(() => {
    const now = new Date();
    if (period === "Bulanan") {
      return allTransactions.filter((tx) => {
        const d = new Date(tx.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
    }
    // Tahunan: current year
    return allTransactions.filter((tx) => new Date(tx.date).getFullYear() === now.getFullYear());
  }, [allTransactions, period]);

  // Yearly chart data: aggregate allTransactions by month for current year
  const yearlyData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthName = new Date(now.getFullYear(), i, 1).toLocaleString("id-ID", { month: "short" });
      const monthTxs = allTransactions.filter((tx) => {
        const d = new Date(tx.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === i;
      });
      const income = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = monthTxs.filter((t) => t.type !== "income").reduce((s, t) => s + t.amount, 0);
      return { month: monthName, income, expense, balance: income - expense };
    });
    return months;
  }, [allTransactions]);

  const chartData = period === "Bulanan" ? monthlyData : yearlyData;

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type !== "income").reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [transactions]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => {
      const cat = t.category?.name ?? "Lainnya";
      map[cat] = (map[cat] ?? 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const periodLabel = useMemo(() => {
    const now = new Date();
    if (period === "Bulanan") {
      return now.toLocaleString("id-ID", { month: "long", year: "numeric" });
    }
    return `Tahun ${now.getFullYear()}`;
  }, [period]);

  async function handleExport(type: "pdf" | "excel" | "csv") {
    if (transactions.length === 0) {
      toast.error("Tidak ada data untuk diekspor pada periode ini");
      return;
    }
    setExporting(type);
    try {
      const meta = { periodLabel, generatedAt: new Date().toLocaleString("id-ID") };
      if (type === "pdf") {
        exportToPDF(transactions, totals, meta);
      } else if (type === "excel") {
        exportToExcel(transactions, totals, meta);
      } else {
        exportToCSV(transactions);
      }
      toast.success(`Laporan ${type.toUpperCase()} berhasil diunduh`);
    } catch {
      toast.error(`Gagal mengekspor ke ${type.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Laporan Keuangan</h1>
          <p className="text-sm text-text-secondary mt-0.5">Ringkasan aktivitas finansial — {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport("pdf")} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors disabled:opacity-50">
            {exporting === "pdf" ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} PDF
          </button>
          <button onClick={() => handleExport("excel")} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors disabled:opacity-50">
            {exporting === "excel" ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Excel
          </button>
          <button onClick={() => handleExport("csv")} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors disabled:opacity-50">
            {exporting === "csv" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} CSV
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {PERIOD_TABS.map((tab) => (
          <button key={tab} onClick={() => setPeriod(tab)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              period === tab ? "border-text-primary text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
            )}>
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Pemasukan</p>
          <p className="text-2xl font-semibold text-success tabular-nums">{formatCurrency(totals.income, true)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Pengeluaran</p>
          <p className="text-2xl font-semibold text-danger tabular-nums">{formatCurrency(totals.expense, true)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Net Cash Flow</p>
          <p className={cn("text-2xl font-semibold tabular-nums", totals.net >= 0 ? "text-success" : "text-danger")}>
            {totals.net >= 0 ? "+" : ""}{formatCurrency(totals.net, true)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-text-secondary text-sm">Memuat data...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-base p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-1">Income vs Expense</h3>
              <p className="text-xs text-text-secondary mb-4">{period === "Bulanan" ? "6 bulan terakhir" : `Sepanjang tahun ${new Date().getFullYear()}`}</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, true)} width={64} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="income" name="Pemasukan" fill="#22C55E" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {categoryData.length > 0 ? (
              <div className="card-base p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-1">Distribusi Pengeluaran</h3>
                <p className="text-xs text-text-secondary mb-4">Per kategori — {periodLabel}</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={2} dataKey="value">
                        {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {categoryData.slice(0, 6).map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-xs text-text-secondary truncate">{item.name}</span>
                        </div>
                        <span className="text-xs text-text-primary font-medium tabular-nums">{formatCurrency(item.value, true)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-base p-5 flex items-center justify-center">
                <p className="text-text-secondary text-sm">Belum ada data pengeluaran pada periode ini</p>
              </div>
            )}
          </div>

          {transactions.length > 0 ? (
            <div className="card-base">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Detail Transaksi</h3>
                <span className="text-xs text-text-secondary">{transactions.length} transaksi</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {["Tanggal", "Nama", "Kategori", "Metode", "Nominal"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] text-accent uppercase tracking-widest font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.slice(0, 100).map((tx) => (
                      <tr key={tx.id} className="hover:bg-surface/30 transition-colors">
                        <td className="px-5 py-3 text-xs text-text-secondary tabular-nums whitespace-nowrap">{tx.date}</td>
                        <td className="px-5 py-3 text-sm text-text-primary">{tx.name}</td>
                        <td className="px-5 py-3 text-xs text-text-secondary">{tx.category?.name ?? "—"}</td>
                        <td className="px-5 py-3 text-xs text-text-secondary capitalize">{tx.payment_method.replace("_", " ")}</td>
                        <td className={cn("px-5 py-3 text-sm font-semibold tabular-nums text-right",
                          tx.type === "income" ? "text-success" : "text-text-primary"
                        )}>
                          {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {transactions.length > 100 && (
                <p className="px-5 py-3 text-xs text-text-secondary border-t border-border">
                  Menampilkan 100 dari {transactions.length} transaksi. Export ke Excel/PDF untuk data lengkap.
                </p>
              )}
            </div>
          ) : (
            <div className="card-base p-8 flex items-center justify-center">
              <p className="text-text-secondary text-sm">Belum ada transaksi pada periode ini</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}