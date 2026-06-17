"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Plus, CreditCard, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, calculateProgress, daysUntil, cn } from "@/utils";
import { StatusBadge, PriorityBadge } from "@/components/shared/Badges";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DebtPaymentModal } from "@/components/debts/DebtPaymentModal";
import { DebtFormModal } from "@/components/debts/DebtFormModal";
import { getDebts, deleteDebt } from "@/lib/db";
import { toast } from "sonner";
import type { Debt } from "@/types";

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try { setDebts(await getDebts()); }
    catch { toast.error("Gagal memuat data utang"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const active = debts.filter((d) => d.status === "active");
  const completed = debts.filter((d) => d.status === "completed");
  const displayed = tab === "active" ? active : completed;
  const totalDebt = active.reduce((s, d) => s + Number(d.remaining), 0);
  const totalPaid = active.reduce((s, d) => s + Number(d.total_paid), 0);

  async function handleDelete(id: string) {
    try { await deleteDebt(id); toast.success("Utang dihapus"); load(); }
    catch { toast.error("Gagal menghapus"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Manajemen Utang</h1>
          <p className="text-sm text-text-secondary mt-0.5">{active.length} utang aktif</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors">
          <Plus size={13} /> Tambah Utang
        </button>
      </div>

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

      <div className="flex gap-1 border-b border-border">
        {(["active", "completed"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t ? "border-text-primary text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
            )}>
            {t === "active" ? `Aktif (${active.length})` : `Lunas (${completed.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-text-secondary text-sm">Memuat...</div>
      ) : displayed.length === 0 ? (
        <EmptyState icon={CreditCard} title="Belum ada utang"
          description={tab === "active" ? "Tambah utang pertama kamu." : "Belum ada utang yang lunas."}
          action={tab === "active" ? (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold">
              <Plus size={13} /> Tambah Utang
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayed.map((debt) => {
            const pct = calculateProgress(Number(debt.total_paid), Number(debt.total_amount));
            const days = daysUntil(debt.due_date);
            const isOverdue = days < 0;
            const isDueSoon = days >= 0 && days <= 14;
            return (
              <div key={debt.id} className="card-base p-5 hover:border-accent transition-colors group">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      debt.status === "completed" ? "bg-success/10" : "bg-surface")}>
                      {debt.status === "completed"
                        ? <CheckCircle2 size={16} className="text-success" />
                        : <CreditCard size={16} className="text-text-secondary" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{debt.name}</p>
                      <p className="text-xs text-text-secondary">{debt.lender}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={debt.priority} />
                    <button onClick={() => setDeleteId(debt.id)}
                      className="opacity-0 group-hover:opacity-100 text-accent hover:text-danger transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Total", val: debt.total_amount, color: "text-text-primary" },
                    { label: "Terbayar", val: debt.total_paid, color: "text-success" },
                    { label: "Sisa", val: debt.remaining, color: "text-danger" },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <p className="text-[10px] text-accent uppercase mb-1">{label}</p>
                      <p className={cn("text-sm font-semibold tabular-nums", color)}>{formatCurrency(Number(val), true)}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-3">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-text-secondary">Progress</span>
                    <span className="text-xs font-semibold tabular-nums">{Math.round(pct)}%</span>
                  </div>
                  <ProgressBar value={pct} color={pct >= 80 ? "success" : pct >= 50 ? "default" : "warning"} size="md" />
                </div>

                <div className={cn("flex items-center gap-2 p-2.5 rounded-md text-xs",
                  isOverdue ? "bg-danger/10 text-danger" : isDueSoon ? "bg-warning/10 text-warning" : "bg-surface text-text-secondary")}>
                  {(isOverdue || isDueSoon) && <AlertCircle size={12} />}
                  {isOverdue ? `Sudah jatuh tempo ${Math.abs(days)} hari lalu`
                    : isDueSoon ? `Jatuh tempo ${days} hari lagi — ${formatDate(debt.due_date)}`
                    : `Jatuh tempo: ${formatDate(debt.due_date)}`}
                </div>

                {debt.status === "active" && (
                  <button onClick={() => setPayDebt(debt)}
                    className="mt-3 w-full py-2 border border-border text-text-secondary text-xs font-medium rounded-md hover:border-text-primary hover:text-text-primary transition-colors">
                    Catat Pembayaran
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DebtFormModal open={showForm} onClose={() => { setShowForm(false); load(); }} />
      <DebtPaymentModal debt={payDebt} open={!!payDebt} onClose={() => { setPayDebt(null); load(); }} />
      <ConfirmDialog open={!!deleteId} title="Hapus Utang?" description="Data utang ini akan dihapus permanen."
        confirmLabel="Hapus" confirmVariant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
