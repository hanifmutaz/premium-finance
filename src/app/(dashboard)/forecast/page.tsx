"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, Calendar, Target, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils";
import { generateForecast } from "@/lib/calculations";
import { mockDebts, mockDashboardStats } from "@/lib/mock-data";
import type { ForecastInput } from "@/types";

const DEFAULT_INPUT: ForecastInput = {
  monthly_income: 12450000,
  fixed_expenses: 4820000,
  debt_allocation: 875000,
  savings_allocation: 2000000,
};

function InputField({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-text-secondary mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-xs">Rp</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-input border border-border rounded-md pl-8 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors tabular-nums"
        />
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-card border border-border rounded-lg px-3 py-2.5 shadow-xl">
      <p className="text-xs text-text-secondary mb-2 font-medium">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="text-text-primary font-medium tabular-nums">
            {formatCurrency(entry.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ForecastPage() {
  const [input, setInput] = useState<ForecastInput>(DEFAULT_INPUT);
  const [scenario, setScenario] = useState<"normal" | "best" | "worst">("normal");

  const totalDebt = mockDebts
    .filter((d) => d.status === "active")
    .reduce((s, d) => s + d.remaining, 0);

  const forecast = useMemo(
    () => generateForecast(input, totalDebt, 12),
    [input, totalDebt]
  );

  const scenarioData = {
    normal: forecast.normal_case,
    best: forecast.best_case,
    worst: forecast.worst_case,
  }[scenario];

  const surplus = input.monthly_income - input.fixed_expenses - input.debt_allocation - input.savings_allocation;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Forecast Keuangan</h1>
        <p className="text-sm text-text-secondary mt-0.5">Simulasi keuangan 12 bulan ke depan</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Input panel */}
        <div className="card-base p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Parameter Simulasi</h3>
            <button
              onClick={() => setInput(DEFAULT_INPUT)}
              className="text-accent hover:text-text-primary transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <InputField
            label="Pendapatan Tetap / Bulan"
            value={input.monthly_income}
            onChange={(v) => setInput({ ...input, monthly_income: v })}
          />
          <InputField
            label="Pengeluaran Tetap / Bulan"
            value={input.fixed_expenses}
            onChange={(v) => setInput({ ...input, fixed_expenses: v })}
          />
          <InputField
            label="Alokasi Bayar Utang / Bulan"
            value={input.debt_allocation}
            onChange={(v) => setInput({ ...input, debt_allocation: v })}
          />
          <InputField
            label="Alokasi Tabungan / Bulan"
            value={input.savings_allocation}
            onChange={(v) => setInput({ ...input, savings_allocation: v })}
          />

          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">Surplus Bersih</span>
              <span className={surplus >= 0 ? "text-success font-semibold tabular-nums" : "text-danger font-semibold tabular-nums"}>
                {formatCurrency(surplus, true)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">Total Utang</span>
              <span className="text-danger font-semibold tabular-nums">{formatCurrency(totalDebt, true)}</span>
            </div>
            {forecast.debt_free_date && (
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Estimasi Bebas Utang</span>
                <span className="text-success font-semibold">{forecast.debt_free_date}</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart area */}
        <div className="xl:col-span-2 space-y-4">
          {/* Scenario selector */}
          <div className="flex gap-2">
            {(["best", "normal", "worst"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  scenario === s
                    ? "bg-text-primary text-background"
                    : "border border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {s === "best" ? "Skenario Terbaik" : s === "normal" ? "Skenario Normal" : "Skenario Terburuk"}
              </button>
            ))}
          </div>

          {/* Balance forecast */}
          <div className="card-base p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Proyeksi Saldo</h3>
            <p className="text-xs text-text-secondary mb-4">Estimasi saldo bersih 12 bulan</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={scenarioData}>
                <defs>
                  <linearGradient id="balFG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="savFG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, true)} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="balance" name="Saldo" stroke="#22C55E" strokeWidth={2} fill="url(#balFG)" dot={false} />
                <Area type="monotone" dataKey="cumulative_savings" name="Tabungan" stroke="#94A3B8" strokeWidth={1.5} fill="url(#savFG)" dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Debt trend forecast */}
          <div className="card-base p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Proyeksi Utang</h3>
            <p className="text-xs text-text-secondary mb-4">Sisa utang per bulan</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={scenarioData}>
                <defs>
                  <linearGradient id="debtFG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, true)} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="remaining_debt" name="Sisa Utang" stroke="#EF4444" strokeWidth={2} fill="url(#debtFG)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Milestone cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "1 Bulan", idx: 0 },
              { label: "3 Bulan", idx: 2 },
              { label: "6 Bulan", idx: 5 },
              { label: "12 Bulan", idx: 11 },
            ].map(({ label, idx }) => {
              const d = scenarioData[idx];
              return (
                <div key={label} className="card-base p-3 text-center">
                  <p className="text-[10px] text-accent uppercase tracking-wide mb-1.5">{label}</p>
                  <p className="text-sm font-bold text-success tabular-nums">
                    {d ? formatCurrency(d.balance, true) : "—"}
                  </p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    Utang: {d ? formatCurrency(d.remaining_debt, true) : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
