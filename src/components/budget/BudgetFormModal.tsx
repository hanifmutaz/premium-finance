"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/utils";
import { addBudget, updateBudget } from "@/lib/db";
import { toast } from "sonner";
import type { Budget, BudgetPeriod } from "@/types";

const CATEGORY_COLORS = [
  "#64748B", "#475569", "#334155", "#94A3B8", "#22C55E",
  "#F59E0B", "#8B5CF6", "#EC4899", "#3B82F6", "#EF4444",
];

const PRESET_CATEGORIES_MONTHLY = [
  "Makan & Minum", "Transport", "Kost / Sewa", "Bayar Utang",
  "Tabungan", "Belanja", "Langganan", "Lainnya",
];
const PRESET_CATEGORIES_WEEKLY = [
  "Makan Harian", "Transport", "Belanja", "Hiburan", "Tabungan Minggu", "Lainnya",
];

interface CatRow {
  id?: string;
  name: string;
  planned_amount: string;
  actual_amount: number;
  color: string;
}

interface Props {
  defaultPeriod: BudgetPeriod;
  onClose: () => void;
  onAdded: () => void;
  editData?: Budget | null;
}

function presetCats(period: BudgetPeriod): CatRow[] {
  return (period === "monthly" ? PRESET_CATEGORIES_MONTHLY : PRESET_CATEGORIES_WEEKLY)
    .map((n, i) => ({ name: n, planned_amount: "", actual_amount: 0, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));
}

export function BudgetFormModal({ defaultPeriod, onClose, onAdded, editData }: Props) {
  const isEdit = !!editData;
  const [period, setPeriod] = useState<BudgetPeriod>(defaultPeriod);
  const [name, setName] = useState("");
  const [totalIncome, setTotalIncome] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CatRow[]>(() => presetCats(defaultPeriod));

  useEffect(() => {
    if (editData) {
      setPeriod(editData.period);
      setName(editData.name);
      setTotalIncome(String(editData.total_income));
      setNotes(editData.notes ?? "");
      setCategories(
        editData.categories.map((c, i) => ({
          id: c.id,
          name: c.name,
          planned_amount: String(c.planned_amount),
          actual_amount: Number(c.actual_amount) || 0,
          color: c.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        }))
      );
    }
  }, [editData]);

  const now = new Date();
  const totalPlanned = categories.reduce((s, c) => s + (parseFloat(c.planned_amount) || 0), 0);
  const income = parseFloat(totalIncome) || 0;
  const remaining = income - totalPlanned;

  function addCategory() {
    setCategories((prev) => [
      ...prev,
      { name: "", planned_amount: "", actual_amount: 0, color: CATEGORY_COLORS[prev.length % CATEGORY_COLORS.length] },
    ]);
  }

  function removeCategory(idx: number) {
    setCategories((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCat(idx: number, field: "name" | "planned_amount" | "color", value: string) {
    setCategories((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function handlePeriodChange(p: BudgetPeriod) {
    if (isEdit) return; // period locked once created
    setPeriod(p);
    setCategories(presetCats(p));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cats = categories.filter((c) => c.name && parseFloat(c.planned_amount) > 0);

    if (cats.length === 0) {
      toast.error("Tambahkan minimal 1 kategori dengan nominal");
      return;
    }
    if (!totalIncome || income <= 0) {
      toast.error("Total pemasukan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      if (isEdit && editData) {
        await updateBudget(editData.id, {
          name: name || editData.name,
          total_income: income,
          notes: notes || undefined,
          categories: cats.map((c) => ({
            id: c.id,
            name: c.name,
            planned_amount: parseFloat(c.planned_amount),
            actual_amount: c.actual_amount,
            color: c.color,
          })),
        });
        toast.success("Budget berhasil diperbarui!");
      } else {
        const budgetName = name || `Budget ${period === "monthly" ? "Bulanan" : "Mingguan"} ${now.toLocaleString("id-ID", { month: "long" })} ${now.getFullYear()}`;
        await addBudget({
          name: budgetName,
          period,
          year: now.getFullYear(),
          month: period === "monthly" ? now.getMonth() + 1 : undefined,
          week: period === "weekly" ? Math.ceil(now.getDate() / 7) : undefined,
          total_income: income,
          notes: notes || undefined,
          categories: cats.map((c) => ({
            name: c.name,
            planned_amount: parseFloat(c.planned_amount),
            color: c.color,
          })),
        });
        toast.success("Budget berhasil dibuat!");
      }
      onAdded();
    } catch {
      toast.error(isEdit ? "Gagal memperbarui budget" : "Gagal menyimpan budget");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-text-secondary transition-colors";
  const labelClass = "block text-xs font-medium text-text-secondary mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-card border border-border rounded-xl shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{isEdit ? "Edit Budget" : "Buat Budget Baru"}</h2>
            <p className="text-xs text-text-secondary mt-0.5">Set rencana pengeluaran per kategori</p>
          </div>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Period Toggle */}
          <div>
            <label className={labelClass}>Periode {isEdit && <span className="text-accent">(tidak bisa diubah)</span>}</label>
            <div className="flex gap-2">
              {(["monthly", "weekly"] as BudgetPeriod[]).map((p) => (
                <button key={p} type="button" onClick={() => handlePeriodChange(p)} disabled={isEdit}
                  className={cn(
                    "flex-1 py-2 rounded-md text-sm font-medium border transition-colors",
                    period === p ? "bg-text-primary text-background border-text-primary" : "border-border text-text-secondary hover:border-accent",
                    isEdit && "opacity-60 cursor-not-allowed"
                  )}>
                  {p === "monthly" ? "Bulanan" : "Mingguan"}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className={labelClass}>Nama Budget (opsional)</label>
            <input className={inputClass} placeholder={`Budget ${period === "monthly" ? "Bulanan" : "Mingguan"} ${now.toLocaleString("id-ID", { month: "long" })}`}
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Income */}
          <div>
            <label className={labelClass}>Total Pemasukan (Rp)</label>
            <input className={inputClass} type="number" min="0" placeholder="cth: 12450000"
              value={totalIncome} onChange={(e) => setTotalIncome(e.target.value)} required />
          </div>

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={cn(labelClass, "mb-0")}>Alokasi per Kategori</label>
              <button type="button" onClick={addCategory}
                className="flex items-center gap-1 text-xs text-accent hover:text-text-primary transition-colors">
                <Plus size={12} /> Tambah
              </button>
            </div>
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) => updateCat(idx, "color", e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent shrink-0"
                  />
                  <input
                    className={cn(inputClass, "flex-1")}
                    placeholder="Nama kategori"
                    value={cat.name}
                    onChange={(e) => updateCat(idx, "name", e.target.value)}
                  />
                  <input
                    className={cn(inputClass, "w-32")}
                    type="number"
                    min="0"
                    placeholder="Rp"
                    value={cat.planned_amount}
                    onChange={(e) => updateCat(idx, "planned_amount", e.target.value)}
                  />
                  <button type="button" onClick={() => removeCategory(idx)}
                    className="text-accent hover:text-danger transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            {isEdit && (
              <p className="text-[10px] text-warning mt-2">
                Menghapus kategori akan menghapus juga riwayat realisasi (actual) kategori tersebut.
              </p>
            )}
          </div>

          {/* Summary */}
          {income > 0 && (
            <div className="bg-surface rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Total direncanakan</span>
                <span className="text-text-primary font-medium">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(totalPlanned)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Sisa income</span>
                <span className={cn("font-semibold", remaining >= 0 ? "text-success" : "text-danger")}>
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(remaining)}
                </span>
              </div>
              {remaining < 0 && (
                <p className="text-[10px] text-danger">⚠️ Total alokasi melebihi pemasukan!</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelClass}>Catatan (opsional)</label>
            <textarea className={cn(inputClass, "resize-none")} rows={2}
              placeholder="cth: Fokus kurangi makan di luar bulan ini"
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border shrink-0 flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 rounded-md border border-border text-sm text-text-secondary hover:border-accent transition-colors">
            Batal
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2 rounded-md bg-text-primary text-background text-sm font-semibold hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Budget"}
          </button>
        </div>
      </div>
    </div>
  );
}