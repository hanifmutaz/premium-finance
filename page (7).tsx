"use client";

import { MoreHorizontal, Calendar, DollarSign } from "lucide-react";
import { formatCurrency, formatDate, calculateProgress } from "@/utils";
import { ProgressBar } from "@/components/shared/ProgressBar";
import type { Debt } from "@/types";

interface DebtOverviewWidgetProps {
  debts: Debt[];
}

export function DebtOverviewWidget({ debts }: DebtOverviewWidgetProps) {
  const active = debts.filter((d) => d.status === "active");
  const totalAmount = active.reduce((s, d) => s + d.total_amount, 0);
  const totalPaid = active.reduce((s, d) => s + d.total_paid, 0);
  const totalRemaining = active.reduce((s, d) => s + d.remaining, 0);
  const overallProgress = calculateProgress(totalPaid, totalAmount);

  // Nearest due
  const nearest = active.sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )[0];

  return (
    <div className="card-base p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Debt Overview</h3>
          <p className="text-xs text-text-secondary mt-0.5">{active.length} utang aktif</p>
        </div>
        <button className="text-accent hover:text-text-primary transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Donut-style progress */}
      <div className="flex gap-6 mb-5">
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Track */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1F2937" strokeWidth="10" />
            {/* Progress */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#F8FAFC"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - overallProgress / 100)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-text-primary">{Math.round(overallProgress)}%</span>
            <span className="text-[10px] text-text-secondary">Terbayar</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-secondary">Total Terbayar</span>
            <span className="text-sm font-semibold text-text-primary tabular-nums">
              {formatCurrency(totalPaid, true)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-secondary">Sisa Utang</span>
            <span className="text-sm font-semibold text-danger tabular-nums">
              {formatCurrency(totalRemaining, true)}
            </span>
          </div>
          {nearest && (
            <>
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-xs text-text-secondary">Jatuh Tempo</span>
                <span className="text-xs font-medium text-warning tabular-nums">
                  {formatDate(nearest.due_date, "dd MMM yyyy")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary">Pembayaran</span>
                <span className="text-xs font-semibold text-text-primary tabular-nums">
                  {formatCurrency(nearest.remaining, true)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Per-debt progress */}
      <div className="space-y-3">
        {active.slice(0, 3).map((debt) => {
          const pct = calculateProgress(debt.total_paid, debt.total_amount);
          return (
            <div key={debt.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-text-primary font-medium truncate">{debt.name}</span>
                  <span className="text-[10px] text-text-secondary shrink-0">{debt.lender}</span>
                </div>
                <span className="text-xs text-text-secondary tabular-nums shrink-0 ml-2">
                  {Math.round(pct)}%
                </span>
              </div>
              <ProgressBar value={pct} size="sm" />
            </div>
          );
        })}
      </div>

      <button className="mt-4 w-full py-2 bg-text-primary text-background text-xs font-semibold rounded-md hover:bg-text-primary/90 transition-colors">
        Bayar Sekarang
      </button>
    </div>
  );
}
