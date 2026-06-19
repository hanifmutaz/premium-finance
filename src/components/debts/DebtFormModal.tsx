"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils";
import { addDebt, updateDebt } from "@/lib/db";
import type { Debt } from "@/types";

interface Props { open: boolean; onClose: () => void; editData?: Debt | null; }

function emptyForm() {
  return {
    name: "", lender: "", total_amount: "",
    start_date: new Date().toISOString().split("T")[0],
    due_date: "", priority: "medium", notes: "",
    is_installment: false,
    installment_amount: "",
    tenor_months: "",
  };
}

export function DebtFormModal({ open, onClose, editData }: Props) {
  const isEdit = !!editData;
  const [loading, setLoading] = useState(false);
  const [showInstallment, setShowInstallment] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (!open) return;
    if (editData) {
      const isInst = !!editData.is_installment;
      setShowInstallment(isInst);
      setForm({
        name: editData.name,
        lender: editData.lender,
        total_amount: String(editData.total_amount),
        start_date: editData.start_date,
        due_date: editData.due_date,
        priority: editData.priority,
        notes: editData.notes ?? "",
        is_installment: isInst,
        installment_amount: editData.installment_amount ? String(editData.installment_amount) : "",
        tenor_months: editData.tenor_months ? String(editData.tenor_months) : "",
      });
    } else {
      setForm(emptyForm());
      setShowInstallment(false);
    }
  }, [open, editData]);

  // Auto-calculate total from installment fields
  useEffect(() => {
    if (!form.is_installment) return;
    const inst = parseFloat(form.installment_amount);
    const tenor = parseInt(form.tenor_months);
    if (inst > 0 && tenor > 0 && !isEdit) {
      setForm((f) => ({ ...f, total_amount: String(inst * tenor) }));
    }
  }, [form.installment_amount, form.tenor_months, form.is_installment, isEdit]);

  function toggleInstallment() {
    const next = !showInstallment;
    setShowInstallment(next);
    setForm((f) => ({ ...f, is_installment: next, installment_amount: "", tenor_months: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.lender || !form.total_amount || !form.due_date) {
      toast.error("Nama, pemberi utang, nominal, dan jatuh tempo wajib diisi");
      return;
    }
    if (form.is_installment && (!form.installment_amount || !form.tenor_months)) {
      toast.error("Cicilan per bulan dan tenor wajib diisi untuk utang cicilan");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        lender: form.lender,
        total_amount: parseFloat(form.total_amount),
        start_date: form.start_date,
        due_date: form.due_date,
        priority: form.priority as "low" | "medium" | "high",
        notes: form.notes || undefined,
        is_installment: form.is_installment,
        installment_amount: form.is_installment && form.installment_amount
          ? parseFloat(form.installment_amount) : null,
        tenor_months: form.is_installment && form.tenor_months
          ? parseInt(form.tenor_months) : null,
      };

      if (isEdit && editData) {
        await updateDebt(editData.id, payload);
        toast.success("Utang berhasil diperbarui");
      } else {
        await addDebt(payload);
        toast.success("Utang berhasil ditambahkan");
      }
      setForm(emptyForm());
      onClose();
    } catch { toast.error(isEdit ? "Gagal memperbarui utang" : "Gagal menyimpan utang"); }
    finally { setLoading(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-surface-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface-card">
          <h2 className="text-sm font-semibold text-text-primary">{isEdit ? "Edit Utang" : "Tambah Utang"}</h2>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Nama Utang *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="mis. KPR BCA, Pinjaman Laptop..."
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Pemberi Utang *</label>
            <input value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })}
              placeholder="mis. Bank BCA, Mas Budi..."
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
          </div>

          {/* Installment toggle */}
          <button type="button" onClick={toggleInstallment}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-md border text-sm font-medium transition-colors",
              showInstallment
                ? "bg-text-primary/10 border-text-primary text-text-primary"
                : "bg-input border-border text-text-secondary hover:border-accent hover:text-text-primary"
            )}>
            <span>{showInstallment ? "✓ Cicilan Terjadwal (aktif)" : "Ini utang cicilan terjadwal?"}</span>
            {showInstallment ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Installment fields */}
          {showInstallment && (
            <div className="bg-surface rounded-lg border border-border p-4 space-y-3 -mt-1">
              <p className="text-[10px] text-accent uppercase tracking-wider font-medium">Detail Cicilan</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Cicilan / Bulan *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
                    <input type="number" value={form.installment_amount}
                      onChange={(e) => setForm({ ...form, installment_amount: e.target.value })}
                      placeholder="0"
                      className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Tenor (bulan) *</label>
                  <input type="number" value={form.tenor_months}
                    onChange={(e) => setForm({ ...form, tenor_months: e.target.value })}
                    placeholder="mis. 12, 24, 36"
                    className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums" />
                </div>
              </div>
              {form.installment_amount && form.tenor_months && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                  <span className="text-text-secondary">Total otomatis dihitung</span>
                  <span className="font-semibold text-text-primary tabular-nums">
                    Rp {(parseFloat(form.installment_amount || "0") * parseInt(form.tenor_months || "0")).toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Total Utang * {showInstallment && <span className="text-accent">(auto dari cicilan × tenor)</span>}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
              <input type="number" value={form.total_amount}
                onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                placeholder="0" readOnly={showInstallment && !isEdit}
                className={cn(
                  "w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums",
                  showInstallment && !isEdit && "opacity-60 cursor-not-allowed"
                )} />
            </div>
            {isEdit && (
              <p className="text-[10px] text-warning mt-1">
                Mengubah total tidak mengubah riwayat pembayaran yang sudah tercatat.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Tanggal Mulai</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">
                {showInstallment ? "Tgl Cicilan Pertama *" : "Jatuh Tempo *"}
              </label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Prioritas</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface rounded-lg">
              {[{ v: "low", l: "Rendah" }, { v: "medium", l: "Sedang" }, { v: "high", l: "Tinggi" }].map(({ v, l }) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, priority: v })}
                  className={cn("py-1.5 rounded-md text-xs font-medium transition-colors",
                    form.priority === v ? "bg-text-primary text-background" : "text-text-secondary hover:text-text-primary"
                  )}>{l}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Catatan (opsional)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Catatan tambahan..." rows={2}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-md hover:border-accent hover:text-text-primary transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-text-primary text-background text-sm font-semibold rounded-md hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}