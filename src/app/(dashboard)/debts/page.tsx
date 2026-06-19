"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Plus, CreditCard, CheckCircle2, Trash2, Pencil, Repeat, Calendar, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate, calculateProgress, daysUntil, cn } from "@/utils";
import { PriorityBadge } from "@/components/shared/Badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DebtPaymentModal } from "@/components/debts/DebtPaymentModal";
import { DebtFormModal } from "@/components/debts/DebtFormModal";
import { getDebts, deleteDebt } from "@/lib/db";
import { toast } from "sonner";
import type { Debt } from "@/types";

// ─── Installment card ─────────────────────────────────────────────────────────
function InstallmentCard({
  debt, onPay, onEdit, onDelete,
}: { debt: Debt; onPay: () => void; onEdit: () => void; onDelete: () => void }) {
  const paidCount = debt.installments_paid ?? 0;
  const totalCount = debt.tenor_months ?? 0;
  const installPct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
  const dueDateStr = debt.next_due_date ?? debt.due_date;
  const days = daysUntil(dueDateStr);
  const isOverdue = days < 0;
  const isDueSoon = !isOverdue && days <= 7;

  // Estimate finish date
  const remaining_months = totalCount - paidCount;
  const finishDate = (() => {
    if (!remaining_months || remaining_months <= 0) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + remaining_months);
    return formatDate(d.toISOString(), "MMM yyyy");
  })();

  const startDate = debt.start_date ? formatDate(debt.start_date, "MMM yyyy") : null;

  return (
    <div className="bg-surface-card border border-border rounded-xl overflow-hidden hover:border-accent transition-colors group">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shrink-0">
              {debt.status === "completed"
                ? <CheckCircle2 size={16} className="text-success" />
                : <Repeat size={16} className="text-text-secondary" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-text-primary">{debt.name}</p>
                <span className="text-[9px] font-semibold uppercase tracking-wider bg-surface border border-border text-text-secondary px-1.5 py-0.5 rounded">
                  Cicilan
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{debt.lender}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PriorityBadge priority={debt.priority} />
            <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 p-1 text-accent hover:text-text-primary transition-all">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1 text-accent hover:text-danger transition-all">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Two key numbers */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-surface rounded-lg p-3">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Per bulan</p>
            <p className="text-base font-semibold text-text-primary tabular-nums">
              {debt.installment_amount ? formatCurrency(Number(debt.installment_amount), true) : "—"}
            </p>
          </div>
          <div className="bg-surface rounded-lg p-3">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Sisa utang</p>
            <p className="text-base font-semibold text-danger tabular-nums">
              {formatCurrency(Number(debt.remaining), true)}
            </p>
          </div>
        </div>

        {/* Installment timeline progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-text-secondary">
              Cicilan ke-<span className="font-semibold text-text-primary">{paidCount}</span>
              <span className="text-text-secondary"> dari </span>
              <span className="font-semibold text-text-primary">{totalCount}</span> bulan
            </p>
            <p className="text-xs font-semibold text-text-primary tabular-nums">{installPct}%</p>
          </div>
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-text-primary rounded-full transition-all duration-500"
              style={{ width: `${installPct}%` }}
            />
          </div>
          <div className="flex justify-between">
            <p className="text-[10px] text-text-secondary">{startDate ?? "—"}</p>
            <p className="text-[10px] text-text-secondary">
              {debt.status === "completed" ? "✓ Lunas" : finishDate ? `Selesai ${finishDate}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Due date strip */}
      <div className={cn(
        "flex items-center gap-2 px-5 py-2.5 text-xs border-t",
        isOverdue
          ? "bg-danger/10 border-danger/20 text-danger"
          : isDueSoon
            ? "bg-warning/10 border-warning/20 text-warning"
            : "bg-surface border-border text-text-secondary"
      )}>
        {(isOverdue || isDueSoon) && <AlertCircle size={11} />}
        <Calendar size={11} />
        {isOverdue
          ? `Cicilan terlambat ${Math.abs(days)} hari`
          : isDueSoon
            ? `Cicilan ${days} hari lagi`
            : `Cicilan berikutnya`}
        <span className="font-medium ml-auto">{formatDate(dueDateStr)}</span>
      </div>

      {/* Action */}
      {debt.status === "active" && (
        <div className="px-5 py-3 border-t border-border">
          <button onClick={onPay}
            className="w-full py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:border-text-primary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5">
            <Repeat size={11} /> Catat Cicilan
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Regular debt card ────────────────────────────────────────────────────────
function DebtCard({
  debt, onPay, onEdit, onDelete,
}: { debt: Debt; onPay: () => void; onEdit: () => void; onDelete: () => void }) {
  const pct = calculateProgress(Number(debt.total_paid), Number(debt.total_amount));
  const days = daysUntil(debt.due_date);
  const isOverdue = days < 0;
  const isDueSoon = !isOverdue && days <= 14;

  return (
    <div className="bg-surface-card border border-border rounded-xl overflow-hidden hover:border-accent transition-colors group">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
              debt.status === "completed" ? "bg-success/10" : "bg-surface")}>
              {debt.status === "completed"
                ? <CheckCircle2 size={16} className="text-success" />
                : <CreditCard size={16} className="text-text-secondary" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">{debt.name}</p>
              <p className="text-xs text-text-secondary mt-0.5">{debt.lender}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PriorityBadge priority={debt.priority} />
            <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 p-1 text-accent hover:text-text-primary transition-all">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1 text-accent hover:text-danger transition-all">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Main number — sisa utang prominent */}
        <div className="mb-4">
          <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Sisa utang</p>
          <p className="text-2xl font-semibold text-danger tabular-nums">
            {formatCurrency(Number(debt.remaining), true)}
          </p>
          <div className="flex gap-4 mt-2">
            <div>
              <p className="text-[10px] text-text-secondary">Total</p>
              <p className="text-xs font-medium text-text-primary tabular-nums">{formatCurrency(Number(debt.total_amount), true)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-secondary">Terbayar</p>
              <p className="text-xs font-medium text-success tabular-nums">{formatCurrency(Number(debt.total_paid), true)}</p>
            </div>
          </div>
        </div>

        {/* Single progress bar */}
        <div>
          <div className="flex justify-between mb-1.5">
            <p className="text-xs text-text-secondary">Progress</p>
            <p className="text-xs font-semibold text-text-primary tabular-nums">{Math.round(pct)}%</p>
          </div>
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500",
                pct >= 80 ? "bg-success" : pct >= 50 ? "bg-text-primary" : "bg-warning")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Due date strip */}
      <div className={cn(
        "flex items-center gap-2 px-5 py-2.5 text-xs border-t",
        isOverdue
          ? "bg-danger/10 border-danger/20 text-danger"
          : isDueSoon
            ? "bg-warning/10 border-warning/20 text-warning"
            : "bg-surface border-border text-text-secondary"
      )}>
        {(isOverdue || isDueSoon) && <AlertCircle size={11} />}
        <Calendar size={11} />
        {isOverdue ? `Terlambat ${Math.abs(days)} hari` : isDueSoon ? `Jatuh tempo ${days} hari lagi` : "Jatuh tempo"}
        <span className="font-medium ml-auto">{formatDate(debt.due_date)}</span>
      </div>

      {/* Action */}
      {debt.status === "active" && (
        <div className="px-5 py-3 border-t border-border">
          <button onClick={onPay}
            className="w-full py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:border-text-primary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5">
            <CreditCard size={11} /> Catat Pembayaran
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
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

  // Cicilan due this month
  const now = new Date();
  const installmentsDue = active.filter((d) => {
    if (!d.is_installment || !d.next_due_date) return false;
    const due = new Date(d.next_due_date);
    return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
  });
  const installmentTotal = installmentsDue.reduce((s, d) => s + Number(d.installment_amount ?? 0), 0);

  async function handleDelete(id: string) {
    try { await deleteDebt(id); toast.success("Utang dihapus"); load(); }
    catch { toast.error("Gagal menghapus"); }
  }

  function openAdd() { setEditData(null); setShowForm(true); }
  function openEdit(debt: Debt) { setEditData(debt); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditData(null); load(); }

  return (
    <div className="space-y-5">
      {/* Page header */}
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

      {/* Stats row */}
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

      {/* Cicilan bulan ini — compact banner */}
      {installmentsDue.length > 0 && (
        <div className="bg-surface-card border border-border rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Repeat size={14} className="text-warning" />
              <p className="text-xs font-semibold text-text-primary">
                Cicilan Bulan Ini
              </p>
              <span className="text-[10px] bg-surface border border-border text-text-secondary px-1.5 py-0.5 rounded tabular-nums">
                {installmentsDue.length} tagihan
              </span>
            </div>
            <p className="text-sm font-semibold text-text-primary tabular-nums">
              {formatCurrency(installmentTotal, true)}
            </p>
          </div>
          <div className="space-y-2">
            {installmentsDue.map((d) => {
              const days = d.next_due_date ? daysUntil(d.next_due_date) : null;
              const late = days !== null && days < 0;
              const soon = days !== null && !late && days <= 7;
              return (
                <div key={d.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                      late ? "bg-danger" : soon ? "bg-warning" : "bg-accent")} />
                    <p className="text-xs text-text-primary truncate">{d.name}</p>
                    <p className="text-[10px] text-text-secondary shrink-0 flex items-center gap-1">
                      <Calendar size={9} />
                      {d.next_due_date ? formatDate(d.next_due_date, "d MMM") : "—"}
                      {" · "}ke-{(d.installments_paid ?? 0) + 1}/{d.tenor_months}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className={cn("text-xs font-semibold tabular-nums",
                      late ? "text-danger" : "text-text-primary")}>
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

      {/* Content */}
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
          {displayed.map((debt) =>
            debt.is_installment ? (
              <InstallmentCard key={debt.id} debt={debt}
                onPay={() => setPayDebt(debt)}
                onEdit={() => openEdit(debt)}
                onDelete={() => setDeleteId(debt.id)} />
            ) : (
              <DebtCard key={debt.id} debt={debt}
                onPay={() => setPayDebt(debt)}
                onEdit={() => openEdit(debt)}
                onDelete={() => setDeleteId(debt.id)} />
            )
          )}
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