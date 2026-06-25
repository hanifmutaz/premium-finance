"use client";

import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  CreditCard,
  Calendar,
  Repeat,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatCurrency,
  formatDate,
  formatInputNumber,
  parseInputNumber,
} from "@/utils";
import {
  addTransaction,
  getCategories,
  getAccounts,
  getBudgets,
} from "@/lib/db";
import type { Debt, AccountWithBalance, Budget } from "@/types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

interface Props {
  debt: Debt | null;
  open: boolean;
  onClose: () => void;
}

export function DebtPaymentModal({ debt, open, onClose }: Props) {
  const [amountRaw, setAmountRaw] = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [overrideBudgetId, setOverrideBudgetId] = useState("");

  useEffect(() => {
    if (!open || !debt) return;
    if (debt.is_installment && debt.installment_amount) {
      const raw = String(debt.installment_amount);
      setAmountRaw(raw);
      setAmountDisplay(formatInputNumber(raw));
    } else {
      setAmountRaw("");
      setAmountDisplay("");
    }
    setNotes("");
    setCategoryId("");
    setAccountId("");
    setOverrideBudgetId("");
  }, [open, debt]);

  useEffect(() => {
    if (open)
      getCategories("expense")
        .then(setCategories)
        .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open)
      getAccounts()
        .then(setAccounts)
        .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open)
      getBudgets()
        .then((data) => setBudgets(data as Budget[]))
        .catch(() => {});
  }, [open]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInputNumber(e.target.value);
    setAmountRaw(raw);
    setAmountDisplay(formatInputNumber(raw));
  }

  function fillAmount(val: number) {
    const raw = String(Math.round(val));
    setAmountRaw(raw);
    setAmountDisplay(formatInputNumber(raw));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!debt || !amountRaw) return;
    const val = parseFloat(amountRaw);
    if (val <= 0) {
      toast.error("Nominal tidak valid");
      return;
    }
    if (val > Number(debt.remaining)) {
      toast.error(
        `Melebihi sisa utang (${formatCurrency(Number(debt.remaining))})`,
      );
      return;
    }

    setLoading(true);
    try {
      const installmentNum = debt.is_installment
        ? `Cicilan ke-${(debt.installments_paid ?? 0) + 1}`
        : "";
      await addTransaction(
        {
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
        },
        overrideBudgetId || null,
      );
      toast.success(`Pembayaran ${formatCurrency(val)} berhasil dicatat`);
      setAmountRaw("");
      setAmountDisplay("");
      setNotes("");
      setCategoryId("");
      setAccountId("");
      setOverrideBudgetId("");
      onClose();
    } catch {
      toast.error("Gagal mencatat pembayaran");
    } finally {
      setLoading(false);
    }
  }

  if (!open || !debt) return null;

  const isInstallment = !!debt.is_installment;
  const paidCount = debt.installments_paid ?? 0;
  const totalCount = debt.tenor_months ?? 0;
  const remaining = Number(debt.remaining);
  const amount = parseFloat(amountRaw) || 0;

  const expenseBudgets = budgets.filter(
    (b) => b.period === "monthly" || b.period === "weekly",
  );
  const selectedBudget = expenseBudgets.find((b) => b.id === overrideBudgetId);

  function budgetLabel(b: Budget) {
    if (b.period === "monthly" && b.month)
      return `${b.name} · ${MONTHS[(b.month ?? 1) - 1]} ${b.year}`;
    return b.name;
  }

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors";
  const labelClass = "block text-xs text-text-secondary mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-sm bg-surface-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface-card">
          <div className="flex items-center gap-2">
            <CreditCard size={15} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">
              Catat Pembayaran
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-accent hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Debt info card */}
          <div className="p-3 bg-surface rounded-lg border border-border space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {debt.name}
                </p>
                <p className="text-xs text-text-secondary">{debt.lender}</p>
              </div>
              {isInstallment && (
                <span className="flex items-center gap-1 text-[10px] font-medium bg-text-primary/10 text-text-primary px-2 py-0.5 rounded-full shrink-0">
                  <Repeat size={9} /> Cicilan
                </span>
              )}
            </div>
            {isInstallment && totalCount > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-text-secondary">
                    Progress cicilan
                  </span>
                  <span className="text-xs font-semibold text-text-primary tabular-nums">
                    {paidCount} / {totalCount} bulan
                  </span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-text-primary rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (paidCount / totalCount) * 100)}%`,
                    }}
                  />
                </div>
                {debt.next_due_date && (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-accent">
                    <Calendar size={9} /> Cicilan berikutnya:{" "}
                    {formatDate(debt.next_due_date)}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-4 pt-2 border-t border-border">
              <div>
                <p className="text-[10px] text-accent">Sisa Utang</p>
                <p className="text-sm font-semibold text-danger tabular-nums">
                  {formatCurrency(remaining)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-accent">Total Terbayar</p>
                <p className="text-sm font-semibold text-success tabular-nums">
                  {formatCurrency(Number(debt.total_paid))}
                </p>
              </div>
              {isInstallment && debt.installment_amount && (
                <div>
                  <p className="text-[10px] text-accent">Cicilan/Bln</p>
                  <p className="text-sm font-semibold text-text-primary tabular-nums">
                    {formatCurrency(Number(debt.installment_amount))}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass} style={{ marginBottom: 0 }}>
                Jumlah Bayar *
              </label>
              {isInstallment && debt.installment_amount && (
                <button
                  type="button"
                  onClick={() => fillAmount(Number(debt.installment_amount))}
                  className="text-[10px] text-text-primary font-medium hover:underline"
                >
                  Isi nominal cicilan
                </button>
              )}
            </div>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm font-medium">
                Rp
              </span>
              <input
                inputMode="numeric"
                value={amountDisplay}
                onChange={handleAmountChange}
                placeholder="0"
                max={remaining}
                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums"
              />
            </div>
            {amount > 0 && (
              <p className="text-[11px] text-text-secondary mt-1 tabular-nums">
                = {formatCurrency(amount)}
              </p>
            )}
            {/* Quick fill buttons */}
            <div className="flex gap-2 mt-2">
              {(isInstallment
                ? [
                    {
                      label: "Cicilan",
                      val: Number(debt.installment_amount ?? 0),
                    },
                    { label: "50%", val: remaining * 0.5 },
                    { label: "Lunas", val: remaining },
                  ]
                : [
                    { label: "25%", val: remaining * 0.25 },
                    { label: "50%", val: remaining * 0.5 },
                    { label: "Lunas", val: remaining },
                  ]
              ).map(({ label, val }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => fillAmount(val)}
                  className="flex-1 py-1 text-[10px] border border-border rounded text-text-secondary hover:border-accent hover:text-text-primary transition-colors"
                >
                  {label}
                  <span className="block text-[9px] text-accent">
                    {formatCurrency(val, true)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Budget override */}
          {expenseBudgets.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary mb-1.5">
                <BookOpen size={11} className="text-accent" />
                Masukkan ke budget
                <span className="text-accent">(opsional)</span>
              </label>
              <select
                value={overrideBudgetId}
                onChange={(e) => setOverrideBudgetId(e.target.value)}
                className={inputClass}
              >
                <option value="">Otomatis (sesuai tanggal pembayaran)</option>
                {expenseBudgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {budgetLabel(b)}
                  </option>
                ))}
              </select>
              {selectedBudget && (
                <p className="text-[10px] text-warning mt-1.5">
                  ⚡ Dipotong dari budget{" "}
                  <span className="font-semibold">{selectedBudget.name}</span>.
                </p>
              )}
            </div>
          )}

          {/* Akun */}
          <div>
            <label className={labelClass}>
              Bayar dari Akun <span className="text-accent">(opsional)</span>
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputClass}
            >
              <option value="">Gak usah dipotong dari akun manapun</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {formatCurrency(a.balance, true)}
                </option>
              ))}
            </select>
          </div>

          {/* Kategori budget */}
          <div>
            <label className={labelClass}>
              Kategori Budget <span className="text-accent">(opsional)</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">Gak usah dihitung ke budget</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Catatan (opsional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isInstallment
                  ? `Cicilan ke-${paidCount + 1}`
                  : "mis. Cicilan ke-4"
              }
              className={inputClass}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-md hover:border-accent hover:text-text-primary transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !amountRaw}
              className="flex-1 py-2.5 bg-text-primary text-background text-sm font-semibold rounded-md hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Menyimpan..." : "Catat Bayar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
