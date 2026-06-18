"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/utils";
import { addReceivable } from "@/lib/db";
import { toast } from "sonner";
import type { ReceivablePriority } from "@/types";

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export function ReceivableFormModal({ onClose, onAdded }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    borrower: "",
    total_amount: "",
    start_date: new Date().toISOString().split("T")[0],
    due_date: "",
    priority: "medium" as ReceivablePriority,
    notes: "",
  });

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

    setLoading(true);
    try {
      await addReceivable({
        name: form.name,
        borrower: form.borrower,
        total_amount: amount,
        start_date: form.start_date,
        due_date: form.due_date,
        priority: form.priority,
        notes: form.notes || undefined,
      });
      toast.success("Piutang berhasil dicatat!");
      onAdded();
    } catch {
      toast.error("Gagal menyimpan piutang");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-text-secondary transition-colors";
  const labelClass = "block text-xs font-medium text-text-secondary mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-card border border-border rounded-xl shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Catat Piutang Baru</h2>
            <p className="text-xs text-text-secondary mt-0.5">Uang yang lo pinjemin ke orang lain</p>
          </div>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Deskripsi / Nama Piutang</label>
              <input
                className={inputClass}
                placeholder="cth: Pinjaman beli laptop"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Nama Peminjam</label>
              <input
                className={inputClass}
                placeholder="cth: Budi, Andi, dll"
                value={form.borrower}
                onChange={(e) => setForm({ ...form, borrower: e.target.value })}
                required
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Jumlah (Rp)</label>
              <input
                className={inputClass}
                placeholder="cth: 500000"
                value={form.total_amount}
                onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                type="number"
                min="1"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Tanggal Pinjam</label>
              <input
                className={inputClass}
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Jatuh Tempo</label>
              <input
                className={inputClass}
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                required
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Prioritas</label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as ReceivablePriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, priority: p })}
                    className={cn(
                      "flex-1 py-1.5 rounded text-xs font-medium transition-colors border",
                      form.priority === p
                        ? p === "high" ? "bg-danger/20 border-danger text-danger"
                          : p === "medium" ? "bg-warning/20 border-warning text-warning"
                            : "bg-surface border-border text-text-secondary"
                        : "border-border text-text-secondary hover:border-accent"
                    )}
                  >
                    {p === "high" ? "Tinggi" : p === "medium" ? "Sedang" : "Rendah"}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Catatan (opsional)</label>
              <textarea
                className={cn(inputClass, "resize-none")}
                rows={2}
                placeholder="cth: Bayar balik pas gajian"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-md border border-border text-sm text-text-secondary hover:text-text-primary hover:border-accent transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-md bg-text-primary text-background text-sm font-semibold hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Menyimpan..." : "Simpan Piutang"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}