"use client";

import { useState } from "react";
import { X, Loader2, Scale } from "lucide-react";
import { formatCurrency, cn } from "@/utils";
import { updateAccount } from "@/lib/db";
import { toast } from "sonner";
import type { AccountWithBalance } from "@/types";

interface Props {
  account: AccountWithBalance;
  onClose: () => void;
  onDone: () => void;
}

export function AccountReconcileModal({ account, onClose, onDone }: Props) {
  const [realBalance, setRealBalance] = useState(String(Math.round(account.balance)));
  const [loading, setLoading] = useState(false);

  const target = parseFloat(realBalance.replace(/[^0-9-]/g, "")) || 0;
  const delta = target - account.balance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (delta === 0) return;
    setLoading(true);
    try {
      // Geser Saldo Awal sebesar selisihnya. Saldo Awal cuma dipakai sebagai
      // titik tolak perhitungan (saldo = saldo_awal + semua transaksi), jadi
      // ini gak bikin transaksi baru & gak ngutak-ngatik laporan
      // pengeluaran/pemasukan/kategori yang udah tercatat.
      const newInitialBalance = Number(account.initial_balance) + delta;
      await updateAccount(account.id, { initial_balance: newInitialBalance });
      toast.success("Saldo berhasil disesuaikan!");
      onDone();
    } catch {
      toast.error("Gagal menyesuaikan saldo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface-card border border-border rounded-xl shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Sesuaikan Saldo</h2>
            <p className="text-xs text-text-secondary mt-0.5">{account.name}</p>
          </div>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-surface rounded-lg p-3 flex items-center justify-between">
            <span className="text-xs text-text-secondary">Saldo di app sekarang</span>
            <span className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(account.balance)}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Saldo Asli Sekarang (Rp)</label>
            <input
              type="number"
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-text-secondary transition-colors tabular-nums"
              value={realBalance}
              onChange={(e) => setRealBalance(e.target.value)}
              autoFocus
            />
          </div>

          {delta !== 0 && (
            <div className={cn("rounded-lg p-3 text-xs", delta > 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
              Selisih {delta > 0 ? "+" : ""}{formatCurrency(delta)} — bakal disesuaikan lewat Saldo Awal akun, tanpa bikin transaksi baru (laporan pengeluaran/pemasukan/kategori tetap akurat).
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-md border border-border text-sm text-text-secondary hover:border-accent transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading || delta === 0}
              className="flex-1 py-2 rounded-md bg-text-primary text-background text-sm font-semibold hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Scale size={13} />}
              {loading ? "Menyimpan..." : "Sesuaikan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
