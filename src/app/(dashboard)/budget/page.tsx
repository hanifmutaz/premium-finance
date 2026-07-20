"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  Plus, Calendar, CalendarDays, TrendingUp, TrendingDown,
  Target, ChevronDown, ChevronUp, Pencil, Trash2, AlertCircle, CheckCircle2, Link2, RefreshCw,
} from "lucide-react";
import { formatCurrency, calculateProgress, cn } from "@/utils";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BudgetFormModal } from "@/components/budget/BudgetFormModal";
import { getBudgets, deleteBudget, recalculateBudgetActual } from "@/lib/db";
import { toast } from "sonner";
import type { Budget } from "@/types";

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"monthly" | "weekly">("monthly");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Budget | null>(null);
  const [resyncingId, setResyncingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getBudgets();
      setBudgets(data as Budget[]);
      if (data.length > 0 && !expandedId) setExpandedId(data[0].id);
    } catch {
      toast.error("Gagal memuat budget");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = budgets.filter((b) => b.period === tab);

  // Map budget ID -> name untuk lookup parent
  const budgetNameMap = Object.fromEntries(budgets.map((b) => [b.id, b.name]));

  function openAdd() {
    setEditData(null);
    setShowForm(true);
  }

  function openEdit(budget: Budget) {
    setEditData(budget);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditData(null);
    load();
  }

  async function handleDelete(id: string) {
    try {
      await deleteBudget(id);
      toast.success("Budget dihapus");
      setDeleteId(null);
      load();
    } catch {
      toast.error("Gagal menghapus budget");
    }
  }

  async function handleResync(id: string) {
    setResyncingId(id);
    try {
      await recalculateBudgetActual(id);
      toast.success("Realisasi budget disinkronkan ulang dari histori transaksi");
      await load();
    } catch {
      toast.error("Gagal sinkronkan ulang");
    } finally {
      setResyncingId(null);
    }
  }

  async function handleResync(id: string) {
    setResyncingId(id);
    try {
      await recalculateBudgetActual(id);
      toast.success("Realisasi budget disinkronkan ulang dari histori transaksi");
      await load();
    } catch {
      toast.error("Gagal sinkronkan ulang");
    } finally {
      setResyncingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Budget & Planning</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Set rencana keuangan, pantau realisasinya
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors"
        >
          <Plus size={13} /> Buat Budget
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("monthly")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "monthly" ? "border-text-primary text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
          )}
        >
          <Calendar size={14} /> Bulanan
        </button>
        <button
          onClick={() => setTab("weekly")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "weekly" ? "border-text-primary text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
          )}
        >
          <CalendarDays size={14} /> Mingguan
        </button>
      </div>

      {/* Budget List */}
      {loading ? (
        <div className="py-12 text-center text-text-secondary text-sm">Memuat...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Target}
          title={`Belum ada budget ${tab === "monthly" ? "bulanan" : "mingguan"}`}
          description="Buat budget untuk mulai tracking pengeluaran vs rencana"
          action={
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold">
              <Plus size={13} /> Buat Budget
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((budget) => {
            const isExpanded = expandedId === budget.id;
            const totalPlanned = Number(budget.total_planned);
            const totalActual = Number(budget.total_actual);
            const totalIncome = Number(budget.total_income);
            const usagePercent = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
            const surplus = totalIncome - totalActual;
            const isOverBudget = totalActual > totalPlanned;

            return (
              <div key={budget.id} className="card-base overflow-hidden">
                {/* Budget Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-surface/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : budget.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-text-primary truncate">{budget.name}</h3>
                        {isOverBudget ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-danger bg-danger/10 px-1.5 py-0.5 rounded">
                            <AlertCircle size={9} /> Over Budget
                          </span>
                        ) : usagePercent >= 80 ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                            Hampir habis
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                            <CheckCircle2 size={9} /> On-track
                          </span>
                        )}
                      </div>
                      {budget.parent_budget_id && budget.weekly_source_category && (
                        <div className="flex items-center gap-1 mt-1">
                          <Link2 size={9} className="text-accent shrink-0" />
                          <p className="text-[10px] text-accent">
                            Dari <span className="font-medium">{budgetNameMap[budget.parent_budget_id] ?? "Budget Bulanan"}</span>
                            {" · "}kat. <span className="font-medium">{budget.weekly_source_category}</span>
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-text-secondary mt-0.5">
                        Pemasukan: {formatCurrency(totalIncome, true)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResync(budget.id); }}
                        title="Sinkronkan ulang realisasi dari histori transaksi"
                        disabled={resyncingId === budget.id}
                        className="p-1.5 text-accent hover:text-text-primary transition-colors rounded disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={cn(resyncingId === budget.id && "animate-spin")} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(budget); }}
                        className="p-1.5 text-accent hover:text-text-primary transition-colors rounded"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(budget.id); }}
                        className="p-1.5 text-accent hover:text-danger transition-colors rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                      {isExpanded ? <ChevronUp size={14} className="text-accent" /> : <ChevronDown size={14} className="text-accent" />}
                    </div>
                  </div>

                  {/* Summary Row */}
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-wider">Direncanakan</p>
                      <p className="text-sm font-semibold text-text-primary tabular-nums">
                        {formatCurrency(totalPlanned, true)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-wider">Realisasi</p>
                      <p className={cn("text-sm font-semibold tabular-nums", isOverBudget ? "text-danger" : "text-text-primary")}>
                        {formatCurrency(totalActual, true)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-wider">Sisa Income</p>
                      <p className={cn("text-sm font-semibold tabular-nums", surplus >= 0 ? "text-success" : "text-danger")}>
                        {formatCurrency(surplus, true)}
                      </p>
                    </div>
                  </div>

                  {/* Overall Progress */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] text-text-secondary">
                      <span>Pemakaian budget</span>
                      <span>{usagePercent.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", isOverBudget ? "bg-danger" : usagePercent >= 80 ? "bg-warning" : "bg-success")}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded: Category Breakdown */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 animate-fade-in">
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Breakdown per Kategori</p>
                    <div className="space-y-3">
                      {budget.categories.map((cat) => {
                        const plannedAmount = Number(cat.planned_amount);
                        const actualAmount = Number(cat.actual_amount);
                        const catPercent = plannedAmount > 0 ? (actualAmount / plannedAmount) * 100 : 0;
                        const catOver = actualAmount > plannedAmount;
                        const diff = actualAmount - plannedAmount;

                        return (
                          <div key={cat.id} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.color ?? "#64748B" }}
                                />
                                <span className="text-xs text-text-primary font-medium truncate">{cat.name}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={cn("text-xs font-semibold", catOver ? "text-danger" : "text-text-primary")}>
                                  {formatCurrency(actualAmount, true)}
                                </span>
                                <span className="text-xs text-text-secondary"> / {formatCurrency(plannedAmount, true)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all", catOver ? "bg-danger" : catPercent >= 80 ? "bg-warning" : "bg-success")}
                                  style={{ width: `${Math.min(catPercent, 100)}%` }}
                                />
                              </div>
                              <span className={cn("text-[10px] w-10 text-right shrink-0", catOver ? "text-danger" : "text-text-secondary")}>
                                {catOver ? `+${formatCurrency(diff, true)}` : `${catPercent.toFixed(0)}%`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {budget.notes && (
                      <p className="text-xs text-text-secondary italic border-t border-border pt-3 mt-3">
                        📝 {budget.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <BudgetFormModal
          defaultPeriod={tab}
          onClose={closeForm}
          onAdded={closeForm}
          editData={editData}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        title="Hapus Budget"
        description="Yakin mau hapus budget ini? Data tidak bisa dikembalikan."
        confirmLabel="Hapus"
        confirmVariant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}