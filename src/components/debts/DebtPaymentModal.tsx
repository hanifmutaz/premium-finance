"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CreditCard, Calendar, Repeat } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/utils";
import { addTransaction, getCategories, getAccounts } from "@/lib/db";
import type { Debt, AccountWithBalance } from "@/types";

interface Props { debt: Debt | null; open: boolean; onClose: () => void; }

export function DebtPaymentModal({ debt, open, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  // Pre-fill with installment amount if this is a scheduled installment debt
  useEffect(() => {
    if (!open || !debt) return;
    if (debt.is_installment && debt.installment_amount) {
      setAmount(String(debt.installment_amount));
    } else {
      setAmount("");
    }
    setNotes("");
    setCategoryId("");
    setAccountId("");
  }, [open, debt]);

  // Kategori opsional — kalau dipilih (misal "Cicilan"), pembayaran ini akan
  // ikut nambah "Realisasi" di Budget bulan ini kalau ada kategori yang cocok.
  useEffect(() => {
    if (open) getCategories("expense").then(setCategories).catch(() => { });
  }, [open]);

  // Akun opsional — kalau dipilih, saldo akun itu otomatis kepotong sejumlah pembayaran.
  useEffect(() => {
    if (open) getAccounts().then(setAccounts).catch(() => { });
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!debt || !amount) return;
    const val = parseFloat(amount);
    if (val <= 0) { toast.error("Nominal tidak valid"); return; }
    if (val > Number(debt.remaining)) {
      toast.error(`Melebihi sisa utang (${formatCurrency(Number(debt.remaining))})`);
      return;
    }

    setLoading(true);
    try {
      const installmentNum = debt.is_installment
        ? `Cicilan ke-${(debt.installments_paid ?? 0) + 1}`
        : "";
      await addTransaction({
        type: "debt_payment",
        name: `Bayar Utang: ${debt.name}`,
        description: notes || installmentNum || undefined,
        category_id: categoryId || undefined,
        account_id: accountId || undefined,
        amount: val,
        date: new Date().toISOString().split("T")[0],
        payment_method: "transfer",
        status: "completed",
        debt_id: debt.id,
      });
      toast.success(`Pembayaran ${formatCurrency(val)} berhasil dicatat`);
      setAmount(""); setNotes(""); setCategoryId(""); setAccountId("");
      onClose();
    } catch { toast.error("Gagal mencatat pembayaran"); }
    finally { setLoading(false); }
  }

  if (!open || !debt) return null;

  const isInstallment = !!debt.is_installment;
  const paidCount = debt.installments_paid ?? 0;
  const totalCount = debt.tenor_months ?? 0;
  const remaining = Number(debt.remaining);

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
          {/* Debt info card */}
          <div className="p-3 bg-surface rounded-lg border border-border space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-text-primary">{debt.name}</p>
                <p className="text-xs text-text-secondary">{debt.lender}</p>
              </div>
              {isInstallment && (
                <span className="flex items-center gap-1 text-[10px] font-medium bg-text-primary/10 text-text-primary px-2 py-0.5 rounded-full shrink-0">
                  <Repeat size={9} /> Cicilan
                </span>
              )}
            </div>

            {/* Installment progress row */}
            {isInstallment && totalCount > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-text-secondary">Progress cicilan</span>
                  <span className="text-xs font-semibold text-text-primary tabular-nums">
                    {paidCount} / {totalCount} bulan
                  </span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-text-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, (paidCount / totalCount) * 100)}%` }}
                  />
                </div>
                {debt.next_due_date && (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-accent">
                    <Calendar size={9} />
                    Cicilan berikutnya: {formatDate(debt.next_due_date)}
                  </div>
                )}
              </div>
            )}

            {/* Amount summary */}
            <div className="flex gap-4 pt-2 border-t border-border">
              <div>
                <p className="text-[10px] text-accent">Sisa Utang</p>
                <p className="text-sm font-semibold text-danger tabular-nums">{formatCurrency(remaining)}</p>
              </div>
              <div>
                <p className="text-[10px] text-accent">Total Terbayar</p>
                <p className="text-sm font-semibold text-success tabular-nums">{formatCurrency(Number(debt.total_paid))}</p>
              </div>
              {isInstallment && debt.installment_amount && (
                <div>
                  <p className="text-[10px] text-accent">Cicilan/Bln</p>
                  <p className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(Number(debt.installment_amount))}</p>
                </div>
              )}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-text-secondary">Jumlah Bayar *</label>
              {isInstallment && debt.installment_amount && (
                <button type="button"
                  onClick={() => setAmount(String(debt.installment_amount))}
                  className="text-[10px] text-text-primary font-medium hover:underline">
                  Isi nominal cicilan
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0" max={remaining}
                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums" />
            </div>
            <div className="flex gap-2 mt-2">
              {(isInstallment
                ? [
                  { label: "Cicilan", val: Number(debt.installment_amount ?? 0) },
                  { label: "50%", val: Math.round(remaining * 0.5) },
                  { label: "Lunas", val: remaining },
                ]
                : [
                  { label: "25%", val: Math.round(remaining * 0.25) },
                  { label: "50%", val: Math.round(remaining * 0.5) },
                  { label: "Lunas", val: remaining },
                ]
              ).map(({ label, val }) => (
                <button key={label} type="button" onClick={() => setAmount(String(val))}
                  className="flex-1 py-1 text-[10px] border border-border rounded text-text-secondary hover:border-accent hover:text-text-primary transition-colors">
                  {label}
                  <span className="block text-[9px] text-accent">{formatCurrency(val, true)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Akun (opsional) — saldo akun ini bakal otomatis kepotong sejumlah pembayaran. */}
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Bayar dari Akun <span className="text-accent">(opsional)</span>
            </label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors">
              <option value="">Gak usah dipotong dari akun manapun</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance, true)}</option>)}
            </select>
          </div>

          {/* Kategori budget (opsional) — kalau dipilih dan ada budget bulan ini
              dengan kategori yang sama, "Realisasi"-nya bakal ikut nambah. */}
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Kategori Budget <span className="text-accent">(opsional)</span>
            </label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors">
              <option value="">Gak usah dihitung ke budget</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Catatan (opsional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={isInstallment ? `Cicilan ke-${paidCount + 1}` : "mis. Cicilan ke-4"}
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