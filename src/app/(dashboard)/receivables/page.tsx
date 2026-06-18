"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  Plus, Handshake, CheckCircle2, AlertCircle, Trash2,
  DollarSign, Clock, TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate, calculateProgress, daysUntil, cn } from "@/utils";
import { PriorityBadge } from "@/components/shared/Badges";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ReceivableFormModal } from "@/components/receivables/ReceivableFormModal";
import { ReceivablePaymentModal } from "@/components/receivables/ReceivablePaymentModal";
import { getReceivables, recordReceivablePayment, deleteReceivable } from "@/lib/db";
import { toast } from "sonner";
import type { Receivable } from "@/types";

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [collectId, setCollectId] = useState<Receivable | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getReceivables();
      setReceivables(data as Receivable[]);
    } catch {
      toast.error("Gagal memuat piutang");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const active = receivables.filter((r) => r.status === "active");
  const completed = receivables.filter((r) => r.status === "completed");
  const displayed = tab === "active" ? active : completed;

  const totalReceivable = active.reduce((s, r) => s + Number(r.remaining), 0);
  const totalReceived = receivables.reduce((s, r) => s + Number(r.total_received), 0);
  const overdueCount = active.filter((r) => daysUntil(r.due_date) < 0).length;

  async function handlePaymentRecorded(id: string, amount: number, notes?: string) {
    try {
      await recordReceivablePayment(id, amount, notes);
      toast.success("Pembayaran piutang dicatat!");
      setCollectId(null);
      load();
    } catch {
      toast.error("Gagal mencatat pembayaran");
    }
  }

  function handleAdded() {
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    try {
      await deleteReceivable(id);
      toast.success("Piutang dihapus");
      setDeleteId(null);
      load();
    } catch {
      toast.error("Gagal menghapus piutang");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Piutang</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Uang yang lo pinjemin ke orang lain — {active.length} piutang aktif
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors"
        >
          <Plus size={13} /> Catat Piutang
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Piutang Aktif</p>
          <p className="text-2xl font-semibold text-warning tabular-nums">{formatCurrency(totalReceivable, true)}</p>
          <p className="text-xs text-text-secondary mt-1">{active.length} orang belum lunas</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Sudah Diterima</p>
          <p className="text-2xl font-semibold text-success tabular-nums">{formatCurrency(totalReceived, true)}</p>
          <p className="text-xs text-text-secondary mt-1">{completed.length} piutang lunas</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Jatuh Tempo Lewat</p>
          <p className={cn("text-2xl font-semibold tabular-nums", overdueCount > 0 ? "text-danger" : "text-success")}>
            {overdueCount}
          </p>
          <p className="text-xs text-text-secondary mt-1">{overdueCount > 0 ? "Segera tagih!" : "Semua on-track"}</p>
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

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-text-secondary text-sm">Memuat...</div>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title={tab === "active" ? "Belum ada piutang aktif" : "Belum ada piutang yang lunas"}
          description={tab === "active" ? "Catat uang yang lo pinjemin ke orang lain di sini" : undefined}
          action={tab === "active" ? (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold">
              <Plus size={13} /> Catat Piutang
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {displayed.map((recv) => {
            const progress = calculateProgress(Number(recv.total_received), Number(recv.total_amount));
            const days = daysUntil(recv.due_date);
            const isOverdue = days < 0;

            return (
              <div key={recv.id} className="card-base p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                      "bg-surface border border-border text-text-secondary"
                    )}>
                      {recv.borrower.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-text-primary">{recv.name}</p>
                        <PriorityBadge priority={recv.priority} />
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Peminjam: <span className="text-text-primary font-medium">{recv.borrower}</span>
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Jatuh tempo: {formatDate(recv.due_date)}
                        {recv.status === "active" && (
                          <span className={cn("ml-1.5 font-medium", isOverdue ? "text-danger" : days <= 7 ? "text-warning" : "text-text-secondary")}>
                            {isOverdue ? `(${Math.abs(days)} hari telat)` : `(${days} hari lagi)`}
                          </span>
                        )}
                      </p>
                      {recv.notes && <p className="text-xs text-text-secondary mt-1 italic">{recv.notes}</p>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-text-primary">{formatCurrency(Number(recv.total_amount))}</p>
                    {recv.status === "active" && (
                      <p className="text-xs text-warning mt-0.5">Sisa {formatCurrency(Number(recv.remaining))}</p>
                    )}
                    {recv.status === "completed" && (
                      <p className="text-xs text-success mt-0.5 flex items-center gap-1 justify-end">
                        <CheckCircle2 size={10} /> Lunas
                      </p>
                    )}
                  </div>
                </div>

                <ProgressBar value={progress} className="h-1.5" />

                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-secondary">
                    Diterima {formatCurrency(Number(recv.total_received))} ({progress.toFixed(0)}%)
                  </p>
                  <div className="flex items-center gap-2">
                    {recv.status === "active" && (
                      <button
                        onClick={() => setCollectId(recv)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-success/10 text-success rounded text-xs font-medium hover:bg-success/20 transition-colors"
                      >
                        <DollarSign size={11} /> Catat Terima
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteId(recv.id)}
                      className="p-1.5 text-accent hover:text-danger transition-colors rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <ReceivableFormModal onClose={() => setShowForm(false)} onAdded={handleAdded} />
      )}
      {collectId && (
        <ReceivablePaymentModal
          receivable={collectId}
          onClose={() => setCollectId(null)}
          onConfirm={(amount, notes) => handlePaymentRecorded(collectId.id, amount, notes)}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        title="Hapus Piutang"
        description="Yakin mau hapus catatan piutang ini?"
        confirmLabel="Hapus"
        confirmVariant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}