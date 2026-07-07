"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/utils";
import { addReceivable, updateReceivable, getAccounts } from "@/lib/db";
import { toast } from "sonner";
import type { Receivable, ReceivablePriority, AccountWithBalance } from "@/types";

interface Props {
  onClose: () => void;
  onAdded: () => void;
  editData?: Receivable | null;
}

function emptyForm() {
  return {
    name: "", borrower: "", total_amount: "",
    start_date: new Date().toISOString().split("T")[0],
    due_date: "", priority: "medium" as ReceivablePriority, notes: "",
    account_id: "",
  };
}

export function ReceivableFormModal({ onClose, onAdded, editData }: Props) {
  const isEdit = !!editData;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  useEffect(() => {
    getAccounts()
      .then((accs) => {
        setAccounts(accs);
        setForm((f) => (f.account_id ? f : { ...f, account_id: accs[0]?.id ?? "" }));
      })
      .catch(() => toast.error("Gagal memuat daftar akun"));
  }, []);

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name,
        borrower: editData.borrower,
        total_amount: String(editData.total_amount),
        start_date: editData.start_date,
        due_date: editData.due_date,
        priority: editData.priority,
        notes: editData.notes ?? "",
        account_id: editData.account_id ?? "",
      });
    }
  }, [editData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.total_amount.replace(/\D/g, ""));
    if (!amount || amount <= 0) {
      toast.error("Nominal tidak valid");
      return;
    }
    if (!form.name || !form.borrower || !form.due_date) {
      toast.error("Nama, peminjam, dan jatuh tempo wajib diisi");
      return;
    }
    if (!isEdit && !form.account_id) {
      toast.error("Pilih akun sumber dana dulu");
      return;
    }

    setLoading(true);
    try {
      if (isEdit && editData) {
        await updateReceivable(editData.id, {
          name: form.name,
          borrower: form.borrower,
          total_amount: amount,
          start_date: form.start_date,
          due_date: form.due_date,
          priority: form.priority,
          notes: form.notes || undefined,
          account_id: form.account_id || undefined,
        });
        toast.success("Piutang berhasil diperbarui!");
      } else {
        await addReceivable({
          name: form.name,
          borrower: form.borrower,
          total_amount: amount,
          start_date: form.start_date,
          due_date: form.due_date,
          priority: form.priority,
          notes: form.notes || undefined,
          account_id: form.account_id,
        });
        toast.success("Piutang berhasil dicatat & saldo akun ke-update!");
      }
      onAdded();
    } catch {
      toast.error(isEdit ? "Gagal memperbarui piutang" : "Gagal menyimpan piutang");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-surface-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface-card">
          <h2 className="text-sm font-semibold text-text-primary">{isEdit ? "Edit Piutang" : "Catat Piutang Baru"}</h2>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Nama Piutang *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="mis. Pinjaman ke Budi"
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Peminjam *</label>
            <input value={form.borrower} onChange={(e) => setForm({ ...form, borrower: e.target.value })}
              placeholder="mis. Budi Santoso"
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Total Dipinjamkan *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
              <input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                placeholder="0"
                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums" />
            </div>
            {isEdit && (
              <p className="text-[10px] text-warning mt-1">
                Mengubah total tidak mengubah riwayat penerimaan yang sudah tercatat.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Akun Sumber Dana {!isEdit && "*"}
            </label>
            <select
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
            >
              <option value="">— Pilih akun —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {!isEdit ? (
              <p className="text-[10px] text-text-secondary mt-1">
                Saldo akun ini bakal otomatis berkurang sebesar nominal pinjaman.
              </p>
            ) : (
              <p className="text-[10px] text-warning mt-1">
                Mengubah akun di sini gak ngubah transaksi pengurangan saldo yang udah tercatat.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Tanggal Pinjam</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Jatuh Tempo *</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Prioritas</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface rounded-lg">
              {[{ v: "low", l: "Rendah" }, { v: "medium", l: "Sedang" }, { v: "high", l: "Tinggi" }].map(({ v, l }) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, priority: v as ReceivablePriority })}
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
              className="flex-1 py-2 rounded-md bg-text-primary text-background text-sm font-semibold hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Piutang"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}