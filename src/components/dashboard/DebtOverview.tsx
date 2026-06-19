"use client";

import { Repeat, Calendar, MoreHorizontal } from "lucide-react";
import { formatCurrency, formatDate, calculateProgress, daysUntil, cn } from "@/utils";
import { ProgressBar } from "@/components/shared/ProgressBar";
import type { Debt } from "@/types";

interface Props { debts: Debt[]; }

export function DebtOverviewWidget({ debts }: Props) {
  const active = debts.filter((d) => d.status === "active");
  const totalAmount = active.reduce((s, d) => s + Number(d.total_amount), 0);
  const totalPaid = active.reduce((s, d) => s + Number(d.total_paid), 0);
  const totalRemaining = active.reduce((s, d) => s + Number(d.remaining), 0);
  const overallProgress = calculateProgress(totalPaid, totalAmount);

  // Nearest due: for installments use next_due_date, else due_date
  const nearest = [...active].sort((a, b) => {
    const da = new Date(a.is_installment && a.next_due_date ? a.next_due_date : a.due_date).getTime();
    const db = new Date(b.is_installment && b.next_due_date ? b.next_due_date : b.due_date).getTime();
    return da - db;
  })[0];

  // Cicilan due this month
  const now = new Date();
  const thisMonthInstallments = active.filter((d) => {
    if (!d.is_installment || !d.next_due_date) return false;
    const due = new Date(d.next_due_date);
    return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
  });
  const thisMonthTotal = thisMonthInstallments.reduce(
    (s, d) => s + Number(d.installment_amount ?? 0), 0
  );

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

      {/* Donut progress */}
      <div className="flex gap-6 mb-5">
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1F2937" strokeWidth="10" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="#F8FAFC" strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - overallProgress / 100)}`}
              className="transition-all duration-1000" />
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
                <span className="text-xs text-text-secondary">
                  {nearest.is_installment ? "Cicilan berikutnya" : "Jatuh Tempo"}
                </span>
                <span className="text-xs font-medium text-warning tabular-nums">
                  {formatDate(
                    nearest.is_installment && nearest.next_due_date
                      ? nearest.next_due_date
                      : nearest.due_date,
                    "dd MMM yyyy"
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary">
                  {nearest.is_installment ? "Nominal cicilan" : "Pembayaran"}
                </span>
                <span className="text-xs font-semibold text-text-primary tabular-nums">
                  {formatCurrency(
                    nearest.is_installment
                      ? Number(nearest.installment_amount ?? nearest.remaining)
                      : Number(nearest.remaining),
                    true
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cicilan bulan ini mini-widget */}
      {thisMonthInstallments.length > 0 && (
        <div className="mb-4 p-3 bg-surface rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Repeat size={11} className="text-text-secondary" />
              <span className="text-[10px] font-semibold text-text-primary uppercase tracking-wider">
                Cicilan Bulan Ini
              </span>
            </div>
            <span className="text-xs font-semibold text-text-primary tabular-nums">
              {formatCurrency(thisMonthTotal, true)}
            </span>
          </div>
          <div className="space-y-1.5">
            {thisMonthInstallments.slice(0, 3).map((d) => {
              const days = d.next_due_date ? daysUntil(d.next_due_date) : null;
              const isLate = days !== null && days < 0;
              return (
                <div key={d.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={cn("w-1 h-1 rounded-full shrink-0",
                      isLate ? "bg-danger" : "bg-accent")} />
                    <span className="text-[10px] text-text-secondary truncate">{d.name}</span>
                  </div>
                  <span className={cn("text-[10px] font-medium tabular-nums shrink-0",
                    isLate ? "text-danger" : "text-text-primary")}>
                    {formatCurrency(Number(d.installment_amount), true)}
                  </span>
                </div>
              );
            })}
            {thisMonthInstallments.length > 3 && (
              <p className="text-[10px] text-accent text-center pt-0.5">
                +{thisMonthInstallments.length - 3} lainnya
              </p>
            )}
          </div>
        </div>
      )}

      {/* Per-debt progress */}
      <div className="space-y-3">
        {active.slice(0, 3).map((debt) => {
          const pct = calculateProgress(Number(debt.total_paid), Number(debt.total_amount));
          return (
            <div key={debt.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {debt.is_installment && <Repeat size={9} className="text-accent shrink-0" />}
                  <span className="text-xs text-text-primary font-medium truncate">{debt.name}</span>
                  <span className="text-[10px] text-text-secondary shrink-0">{debt.lender}</span>
                </div>
                <span className="text-xs text-text-secondary tabular-nums shrink-0 ml-2">
                  {Math.round(pct)}%
                </span>
              </div>
              <ProgressBar value={pct} size="sm" />
              {debt.is_installment && debt.tenor_months && (
                <p className="text-[9px] text-accent mt-0.5">
                  {debt.installments_paid ?? 0}/{debt.tenor_months} cicilan
                </p>
              )}
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