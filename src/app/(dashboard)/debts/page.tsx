"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Plus, CreditCard, CheckCircle2, AlertCircle, Trash2, Pencil, Repeat, Calendar } from "lucide-react";
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
  const [editData, setEditData] = useState<Debt | null>(null);

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

  // Installments due this month
  const now = new Date();
  const installmentsDueThisMonth = active.filter((d) => {
    if (!d.is_installment || !d.next_due_date) return false;
    const due = new Date(d.next_due_date);
    return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
  });

  async function handleDelete(id: string) {
    try { await deleteDebt(id); toast.success("Utang dihapus"); load(); }
    catch { toast.error("Gagal menghapus"); }
  }

  function openAdd() { setEditData(null); setShowForm(true); }
  function openEdit(debt: Debt) { setEditData(debt); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditData(null); load(); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Manajemen Utang</h1>
          <p className="text-sm text-text-secondary mt-0.5">{active.length} utang aktif</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors">
          <Plus size={13} /> Tambah Utang
        </button>
      </div>

      {/* Stats */}
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

      {/* Cicilan bulan ini widget */}
      {installmentsDueThisMonth.length > 0 && (
        <div className="card-base p-4 border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-3">
            <Repeat size={14} className="text-warning" />
            <p className="text-xs font-semibold text-text-primary">
              Cicilan Bulan Ini — {installmentsDueThisMonth.length} tagihan
            </p>
          </div>
          <div className="space-y-2">
            {installmentsDueThisMonth.map((d) => {
              const days = d.next_due_date ? daysUntil(d.next_due_date) : null;
              const isOverdue = days !== null && days < 0;
              const isDueSoon = days !== null && days >= 0 && days <= 7;
              return (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                      isOverdue ? "bg-danger" : isDueSoon ? "bg-warning" : "bg-accent")} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{d.name}</p>
                      <p className="text-[10px] text-text-secondary flex items-center gap-1">
                        <Calendar size={9} />
                        {d.next_due_date ? formatDate(d.next_due_date) : "-"}
                        {" · "}
                        Cicilan {(d.installments_paid ?? 0) + 1}/{d.tenor_months ?? "?"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-xs font-semibold text-text-primary tabular-nums">
                      {formatCurrency(Number(d.installment_amount), true)}
                    </p>
                    <button onClick={() => setPayDebt(d)}
                      className="text-[10px] px-2 py-1 bg-text-primary text-background rounded font-medium hover:bg-text-primary/80 transition-colors">
                      Bayar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
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
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold">
              <Plus size={13} /> Tambah Utang
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayed.map((debt) => {
            const pct = calculateProgress(Number(debt.total_paid), Number(debt.total_amount));
            // For installments, show next_due_date; otherwise show due_date
            const dueDateStr = debt.is_installment && debt.next_due_date ? debt.next_due_date : debt.due_date;
            const days = daysUntil(dueDateStr);
            const isOverdue = days < 0;
            const isDueSoon = days >= 0 && days <= 14;
            const installPct = (debt.is_installment && debt.tenor_months)
              ? Math.round(((debt.installments_paid ?? 0) / debt.tenor_months) * 100)
              : null;

            return (
              <div key={debt.id} className="card-base p-5 hover:border-accent transition-colors group">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      debt.status === "completed" ? "bg-success/10" : debt.is_installment ? "bg-text-primary/5" : "bg-surface")}>
                      {debt.status === "completed"
                        ? <CheckCircle2 size={16} className="text-success" />
                        : debt.is_installment
                          ? <Repeat size={16} className="text-text-secondary" />
                          : <CreditCard size={16} className="text-text-secondary" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-text-primary">{debt.name}</p>
                        {debt.is_installment && (
                          <span className="text-[9px] font-medium bg-text-primary/10 text-text-primary px-1.5 py-0.5 rounded-full">
                            Cicilan
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary">{debt.lender}</p>
                      {/* Installment counter */}
                      {debt.is_installment && debt.tenor_months && (
                        <p className="text-[10px] text-accent mt-0.5">
                          Cicilan {(debt.installments_paid ?? 0)}/{debt.tenor_months} bulan
                          {debt.installment_amount && ` · ${formatCurrency(Number(debt.installment_amount), true)}/bln`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={debt.priority} />
                    <button onClick={() => openEdit(debt)}
                      className="opacity-0 group-hover:opacity-100 text-accent hover:text-text-primary transition-all">
                      <Pencil size={14} />
                    </button>
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
                    <span className="text-xs text-text-secondary">Progress Nominal</span>
                    <span className="text-xs font-semibold tabular-nums">{Math.round(pct)}%</span>
                  </div>
                  <ProgressBar value={pct} color={pct >= 80 ? "success" : pct >= 50 ? "default" : "warning"} size="md" />
                </div>

                {/* Extra installment progress bar */}
                {installPct !== null && (
                  <div className="mb-3">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-text-secondary">Progress Bulan</span>
                      <span className="text-xs font-semibold tabular-nums">
                        {debt.installments_paid ?? 0}/{debt.tenor_months} bln
                      </span>
                    </div>
                    <ProgressBar value={installPct} color="default" size="sm" />
                  </div>
                )}

                <div className={cn("flex items-center gap-2 p-2.5 rounded-md text-xs",
                  isOverdue ? "bg-danger/10 text-danger" : isDueSoon ? "bg-warning/10 text-warning" : "bg-surface text-text-secondary")}>
                  {(isOverdue || isDueSoon) && <AlertCircle size={12} />}
                  {debt.is_installment && debt.next_due_date ? (
                    isOverdue
                      ? `Cicilan terlambat ${Math.abs(days)} hari — ${formatDate(debt.next_due_date)}`
                      : isDueSoon
                        ? `Cicilan ${days} hari lagi — ${formatDate(debt.next_due_date)}`
                        : `Cicilan berikutnya: ${formatDate(debt.next_due_date)}`
                  ) : (
                    isOverdue ? `Sudah jatuh tempo ${Math.abs(days)} hari lalu`
                      : isDueSoon ? `Jatuh tempo ${days} hari lagi — ${formatDate(debt.due_date)}`
                        : `Jatuh tempo: ${formatDate(debt.due_date)}`
                  )}
                </div>

                {debt.status === "active" && (
                  <button onClick={() => setPayDebt(debt)}
                    className="mt-3 w-full py-2 border border-border text-text-secondary text-xs font-medium rounded-md hover:border-text-primary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5">
                    {debt.is_installment ? <><Repeat size={11} /> Catat Cicilan</> : "Catat Pembayaran"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DebtFormModal open={showForm} onClose={closeForm} editData={editData} />
      <DebtPaymentModal debt={payDebt} open={!!payDebt} onClose={() => { setPayDebt(null); load(); }} />
      <ConfirmDialog open={!!deleteId} title="Hapus Utang?" description="Data utang ini akan dihapus permanen."
        confirmLabel="Hapus" confirmVariant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}