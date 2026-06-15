"use client";

import { useState } from "react";
import { Plus, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate, calculateProgress, daysUntil, cn } from "@/utils";
import { StatusBadge, PriorityBadge } from "@/components/shared/Badges";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { mockDebts } from "@/lib/mock-data";
import type { Debt } from "@/types";

export default function DebtsPage() {
  const [tab, setTab] = useState<"active" | "completed">("active");

  const active = mockDebts.filter((d) => d.status === "active");
  const completed = mockDebts.filter((d) => d.status === "completed");
  const displayed = tab === "active" ? active : completed;

  const totalDebt = active.reduce((s, d) => s + d.remaining, 0);
  const totalPaid = active.reduce((s, d) => s + d.total_paid, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Manajemen Utang</h1>
          <p className="text-sm text-text-secondary mt-0.5">{active.length} utang aktif</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors">
          <Plus size={13} />
          Tambah Utang
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Sisa Utang</p>
          <p className="text-2xl font-semibold text-danger tabular-nums">{formatCurrency(totalDebt, true)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Terbayar</p>
          <p className="text-2xl font-semibold text-success tabular-nums">{formatCurrency(totalPaid, true)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Utang Lunas</p>
          <p className="text-2xl font-semibold text-text-primary tabular-nums">{completed.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["active", "completed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {t === "active" ? `Aktif (${active.length})` : `Lunas (${completed.length})`}
          </button>
        ))}
      </div>

      {/* Debt cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayed.map((debt) => (
          <DebtCard key={debt.id} debt={debt} />
        ))}
      </div>
    </div>
  );
}

function DebtCard({ debt }: { debt: Debt }) {
  const pct = calculateProgress(debt.total_paid, debt.total_amount);
  const days = daysUntil(debt.due_date);
  const isOverdue = days < 0;
  const isDueSoon = days >= 0 && days <= 14;

  return (
    <div className="card-base p-5 hover:border-accent transition-colors">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            debt.status === "completed" ? "bg-success/10" : "bg-surface"
          )}>
            {debt.status === "completed"
              ? <CheckCircle2 size={16} className="text-success" />
              : <CreditCard size={16} className="text-text-secondary" />
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{debt.name}</p>
            <p className="text-xs text-text-secondary">{debt.lender}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={debt.priority} />
          <StatusBadge status={debt.status} size="sm" />
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-accent uppercase tracking-wide mb-1">Total</p>
          <p className="text-sm font-semibold text-text-primary tabular-nums">
            {formatCurrency(debt.total_amount, true)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-accent uppercase tracking-wide mb-1">Terbayar</p>
          <p className="text-sm font-semibold text-success tabular-nums">
            {formatCurrency(debt.total_paid, true)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-accent uppercase tracking-wide mb-1">Sisa</p>
          <p className="text-sm font-semibold text-danger tabular-nums">
            {formatCurrency(debt.remaining, true)}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between mb-1.5">
          <span className="text-xs text-text-secondary">Progress Pelunasan</span>
          <span className="text-xs font-semibold text-text-primary tabular-nums">{Math.round(pct)}%</span>
        </div>
        <ProgressBar value={pct} color={pct >= 80 ? "success" : pct >= 50 ? "default" : "warning"} size="md" />
      </div>

      {/* Due date */}
      <div className={cn(
        "flex items-center gap-2 p-2.5 rounded-md text-xs",
        isOverdue ? "bg-danger/10 text-danger" :
        isDueSoon ? "bg-warning/10 text-warning" : "bg-surface text-text-secondary"
      )}>
        {isOverdue || isDueSoon ? <AlertCircle size={12} /> : null}
        <span>
          {isOverdue
            ? `Sudah jatuh tempo ${Math.abs(days)} hari lalu`
            : isDueSoon
            ? `Jatuh tempo ${days} hari lagi — ${formatDate(debt.due_date)}`
            : `Jatuh tempo: ${formatDate(debt.due_date)}`
          }
        </span>
      </div>

      {debt.status === "active" && (
        <button className="mt-3 w-full py-2 border border-border text-text-secondary text-xs font-medium rounded-md hover:border-text-primary hover:text-text-primary transition-colors">
          Catat Pembayaran
        </button>
      )}
    </div>
  );
}
