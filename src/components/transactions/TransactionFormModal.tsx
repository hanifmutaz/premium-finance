"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils";
import { useAppStore } from "@/store";
import type { TransactionType, PaymentMethod } from "@/types";

const INCOME_CATEGORIES = ["Gaji", "Bonus", "THR", "Freelance", "Investasi", "Lainnya"];
const EXPENSE_CATEGORIES = [
  "Makan", "Transport", "Tagihan", "Keluarga",
  "Belanja", "Kesehatan", "Investasi Diri", "Hiburan", "Lainnya",
];
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "transfer", label: "Transfer Bank" },
  { value: "cash", label: "Tunai" },
  { value: "credit_card", label: "Kartu Kredit" },
  { value: "debit_card", label: "Kartu Debit" },
  { value: "e-wallet", label: "E-Wallet" },
  { value: "other", label: "Lainnya" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TransactionFormModal({ open, onClose }: Props) {
  const addTransaction = useAppStore((s) => s.addTransaction);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "transfer" as PaymentMethod,
  });

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function reset() {
    setForm({
      name: "",
      description: "",
      category: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      payment_method: "transfer",
    });
    setType("expense");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.amount) {
      toast.error("Nama dan nominal wajib diisi");
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 400)); // simulate

    addTransaction({
      id: `tx-${Date.now()}`,
      user_id: "user-1",
      type,
      name: form.name,
      description: form.description || undefined,
      category_id: form.category || undefined,
      category: form.category
        ? { id: form.category, user_id: "user-1", name: form.category, type: type === "income" ? "income" : "expense", created_at: "" }
        : undefined,
      amount: parseFloat(form.amount.replace(/\D/g, "")),
      date: form.date,
      payment_method: form.payment_method,
      status: "completed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    toast.success("Transaksi berhasil ditambahkan");
    setLoading(false);
    reset();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-surface-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface-card">
          <h2 className="text-sm font-semibold text-text-primary">Tambah Transaksi</h2>
          <button
            onClick={onClose}
            className="text-accent hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-surface rounded-lg">
            {(["income", "expense", "debt_payment", "transfer"] as TransactionType[]).map((t) => {
              const labels = {
                income: "Masuk",
                expense: "Keluar",
                debt_payment: "Utang",
                transfer: "Transfer",
              };
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "py-1.5 rounded-md text-xs font-medium transition-colors",
                    type === t
                      ? "bg-text-primary text-background"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Nama Transaksi *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="mis. Gaji Juli, Bayar Listrik..."
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Nominal *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums"
              />
            </div>
          </div>

          {/* Date + Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Tanggal</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">Pilih kategori</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Metode Pembayaran</label>
            <select
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value as PaymentMethod })}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
            >
              {PAYMENT_METHODS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Keterangan (opsional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Catatan tambahan..."
              rows={2}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {/* Actions */}
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
              disabled={loading}
              className="flex-1 py-2.5 bg-text-primary text-background text-sm font-semibold rounded-md hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
