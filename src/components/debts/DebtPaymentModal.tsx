"use client";

import { useState } from "react";
import { X, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/utils";
import { addTransaction } from "@/lib/db";
import type { Debt } from "@/types";

interface Props { debt: Debt | null; open: boolean; onClose: () => void; }

export function DebtPaymentModal({ debt, open, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!debt || !amount) return;
    const val = parseFloat(amount);
    if (val <= 0) { toast.error("Nominal tidak valid"); return; }
    if (val > Number(debt.remaining)) { toast.error(`Melebihi sisa utang (${formatCurrency(Number(debt.remaining))})`); return; }

    setLoading(true);
    try {
      await addTransaction({
        type: "debt_payment",
        name: `Bayar Utang: ${debt.name}`,
        description: notes || undefined,
        amount: val,
        date: new Date().toISOString().split("T")[0],
        payment_method: "transfer",
        status: "completed",
        debt_id: debt.id,
      });
      toast.success(`Pembayaran ${formatCurrency(val)} berhasil dicatat`);
      setAmount(""); setNotes("");
      onClose();
    } catch { toast.error("Gagal mencatat pembayaran"); }
    finally { setLoading(false); }
  }

  if (!open || !debt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-surface-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CreditCard size={15} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Catat Pembayaran</h2>
          </div>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-surface rounded-lg border border-border space-y-1">
            <p className="text-sm font-semibold text-text-primary">{debt.name}</p>
            <p className="text-xs text-text-secondary">{debt.lender}</p>
            <div className="flex gap-4 mt-2 pt-2 border-t border-border">
              <div>
                <p className="text-[10px] text-accent">Sisa Utang</p>
                <p className="text-sm font-semibold text-danger tabular-nums">{formatCurrency(Number(debt.remaining))}</p>
              </div>
              <div>
                <p className="text-[10px] text-accent">Total Terbayar</p>
                <p className="text-sm font-semibold text-success tabular-nums">{formatCurrency(Number(debt.total_paid))}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Jumlah Bayar *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0" max={Number(debt.remaining)}
                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums" />
            </div>
            <div className="flex gap-2 mt-2">
              {[0.25, 0.5, 1].map((ratio) => {
                const val = Math.round(Number(debt.remaining) * ratio);
                return (
                  <button key={ratio} type="button" onClick={() => setAmount(String(val))}
                    className="flex-1 py-1 text-[10px] border border-border rounded text-text-secondary hover:border-accent hover:text-text-primary transition-colors">
                    {ratio === 1 ? "Lunas" : `${ratio * 100}%`}
                    <span className="block text-[9px] text-accent">{formatCurrency(val, true)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Catatan (opsional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis. Cicilan ke-4"
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-md hover:border-accent hover:text-text-primary transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading || !amount}
              className="flex-1 py-2.5 bg-text-primary text-background text-sm font-semibold rounded-md hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Menyimpan..." : "Catat Bayar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
