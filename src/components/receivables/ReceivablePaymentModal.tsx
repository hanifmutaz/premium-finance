"use client";

import { useState } from "react";
import { X, DollarSign, Loader2 } from "lucide-react";
import { formatCurrency, cn } from "@/utils";
import type { Receivable } from "@/types";

interface Props {
  receivable: Receivable;
  onClose: () => void;
  onConfirm: (amount: number, notes?: string) => void | Promise<void>;
}

export function ReceivablePaymentModal({ receivable, onClose, onConfirm }: Props) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(amount.replace(/\D/g, ""));
    if (!val || val <= 0) return;
    setLoading(true);
    try {
      await onConfirm(Math.min(val, receivable.remaining), notes || undefined);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-text-secondary transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface-card border border-border rounded-xl shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Catat Pembayaran</h2>
            <p className="text-xs text-text-secondary mt-0.5">{receivable.name} — {receivable.borrower}</p>
          </div>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-surface rounded-lg p-3 flex items-center justify-between">
            <span className="text-xs text-text-secondary">Sisa piutang</span>
            <span className="text-sm font-semibold text-warning">{formatCurrency(receivable.remaining)}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Jumlah Diterima (Rp)</label>
            <input
              className={inputClass}
              type="number"
              min="1"
              max={receivable.remaining}
              placeholder={`Maks ${formatCurrency(receivable.remaining)}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setAmount(String(receivable.remaining))}
              className="mt-1.5 text-xs text-accent hover:text-text-primary transition-colors"
            >
              Isi penuh ({formatCurrency(receivable.remaining)})
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Catatan (opsional)</label>
            <input
              className={inputClass}
              placeholder="cth: Transfer via BCA"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-md border border-border text-sm text-text-secondary hover:border-accent transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-md bg-success text-white text-sm font-semibold hover:bg-success/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}
              {loading ? "Menyimpan..." : "Catat Terima"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}