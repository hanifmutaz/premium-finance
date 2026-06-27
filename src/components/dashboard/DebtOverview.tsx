"use client";

import { Repeat, Calendar, MoreHorizontal, CreditCard, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate, calculateProgress, daysUntil, cn } from "@/utils";
import type { Debt } from "@/types";

interface Props { debts: Debt[]; }

export function DebtOverviewWidget({ debts }: Props) {
  const active = debts.filter((d) => d.status === "active" || d.status === "overdue");
  const totalAmount = active.reduce((s, d) => s + Number(d.total_amount), 0);
  const totalPaid = active.reduce((s, d) => s + Number(d.total_paid), 0);
  const totalRemaining = active.reduce((s, d) => s + Number(d.remaining), 0);
  const overallPct = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

  // Cicilan due this month
  const now = new Date();
  const installmentsDue = active.filter((d) => {
    if (!d.is_installment || !d.next_due_date) return false;
    const due = new Date(d.next_due_date);
    return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
  });
  const installmentTotal = installmentsDue.reduce((s, d) => s + Number(d.installment_amount ?? 0), 0);

  // Nearest due across all active debts
  const nearest = [...active].sort((a, b) => {
    const da = new Date(a.is_installment && a.next_due_date ? a.next_due_date : a.due_date).getTime();
    const db = new Date(b.is_installment && b.next_due_date ? b.next_due_date : b.due_date).getTime();
    return da - db;
  })[0];

  return (
    <div className="card-base p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Ringkasan Utang</h3>
          <p className="text-xs text-text-secondary mt-0.5">{active.length} utang aktif</p>
        </div>
        <button className="text-accent hover:text-text-primary transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Big numbers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-lg p-3">
          <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Sisa Utang</p>
          <p className="text-lg font-semibold text-danger tabular-nums">{formatCurrency(totalRemaining, true)}</p>
        </div>
        <div className="bg-surface rounded-lg p-3">
          <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Total Terbayar</p>
          <p className="text-lg font-semibold text-success tabular-nums">{formatCurrency(totalPaid, true)}</p>
        </div>
      </div>

      {/* Overall progress */}
      <div>
        <div className="flex justify-between mb-2">
          <p className="text-xs text-text-secondary">Progress keseluruhan</p>
          <p className="text-xs font-semibold text-text-primary tabular-nums">{overallPct}%</p>
        </div>
        <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-text-primary rounded-full transition-all duration-700"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Cicilan bulan ini */}
      {installmentsDue.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-surface border-b border-border">
            <div className="flex items-center gap-1.5">
              <Repeat size={11} className="text-warning" />
              <p className="text-[10px] font-semibold text-text-primary uppercase tracking-wider">
                Cicilan Bulan Ini
              </p>
            </div>
            <p className="text-xs font-semibold text-text-primary tabular-nums">
              {formatCurrency(installmentTotal, true)}
            </p>
          </div>
          <div className="divide-y divide-border">
            {installmentsDue.slice(0, 3).map((d) => {
              const days = d.next_due_date ? daysUntil(d.next_due_date) : null;
              const late = days !== null && days < 0;
              return (
                <div key={d.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                      late ? "bg-danger" : "bg-accent")} />
                    <p className="text-xs text-text-primary truncate">{d.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {late && <AlertCircle size={10} className="text-danger" />}
                    <p className={cn("text-xs font-medium tabular-nums",
                      late ? "text-danger" : "text-text-primary")}>
                      {formatCurrency(Number(d.installment_amount), true)}
                    </p>
                  </div>
                </div>
              );
            })}
            {installmentsDue.length > 3 && (
              <p className="text-[10px] text-accent text-center py-2">
                +{installmentsDue.length - 3} lainnya
              </p>
            )}
          </div>
        </div>
      )}

      {/* Per-debt list */}
      {active.length > 0 && (
        <div className="space-y-3">
          {active.slice(0, 4).map((debt) => {
            const pct = calculateProgress(Number(debt.total_paid), Number(debt.total_amount));
            const dueDateStr = debt.is_installment && debt.next_due_date ? debt.next_due_date : debt.due_date;
            const days = daysUntil(dueDateStr);
            const late = days < 0;
            const soon = !late && days <= 7;
            return (
              <div key={debt.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {debt.is_installment
                      ? <Repeat size={10} className="text-accent shrink-0" />
                      : <CreditCard size={10} className="text-accent shrink-0" />}
                    <p className="text-xs font-medium text-text-primary truncate">{debt.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(late || soon) && (
                      <span className={cn("text-[10px] font-medium",
                        late ? "text-danger" : "text-warning")}>
                        {late ? `${Math.abs(days)}h lalu` : `${days}h lagi`}
                      </span>
                    )}
                    <p className="text-xs text-text-secondary tabular-nums">{Math.round(pct)}%</p>
                  </div>
                </div>
                <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      pct >= 80 ? "bg-success" : pct >= 50 ? "bg-text-primary" : "bg-warning")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {debt.is_installment && debt.tenor_months && (
                  <p className="text-[9px] text-accent mt-0.5">
                    {debt.installments_paid ?? 0}/{debt.tenor_months} cicilan
                    {debt.installment_amount && ` · ${formatCurrency(Number(debt.installment_amount), true)}/bln`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nearest due footer */}
      {nearest && (
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Calendar size={11} />
            {nearest.is_installment ? "Cicilan berikutnya" : "Jatuh tempo terdekat"}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-text-primary">
              {formatDate(nearest.is_installment && nearest.next_due_date
                ? nearest.next_due_date : nearest.due_date, "d MMM yyyy")}
            </p>
            <p className="text-xs font-semibold text-text-primary tabular-nums">
              {formatCurrency(
                nearest.is_installment
                  ? Number(nearest.installment_amount ?? nearest.remaining)
                  : Number(nearest.remaining),
                true
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}