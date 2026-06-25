"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Loader2, Link2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/utils";
import { addBudget, updateBudget, getBudgets, getCategories } from "@/lib/db";
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

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface TxCategory { id: string; name: string; }

interface CatRow {
  id?: string;
  name: string;
  planned_amount: string;
  actual_amount: number;
  color: string;
  mapped_category_ids: string[];
  keyword_filter: string;
  showMapping: boolean; // UI state, tidak disimpan ke DB
}

interface Props {
  defaultPeriod: BudgetPeriod;
  onClose: () => void;
  onAdded: () => void;
  editData?: Budget | null;
}

function presetCats(period: BudgetPeriod): CatRow[] {
  return (period === "monthly" ? PRESET_CATEGORIES_MONTHLY : PRESET_CATEGORIES_WEEKLY)
    .map((n, i) => ({
      name: n, planned_amount: "", actual_amount: 0,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      mapped_category_ids: [], keyword_filter: "", showMapping: false,
    }));
}

export function BudgetFormModal({ defaultPeriod, onClose, onAdded, editData }: Props) {
  const isEdit = !!editData;
  const now = new Date();

  const [period, setPeriod] = useState<BudgetPeriod>(defaultPeriod);
  const [name, setName] = useState("");
  const [totalIncome, setTotalIncome] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CatRow[]>(() => presetCats(defaultPeriod));
  const [budgetMonth, setBudgetMonth] = useState(now.getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(now.getFullYear());

  // Kategori transaksi (untuk dropdown mapping)
  const [txCategories, setTxCategories] = useState<TxCategory[]>([]);

  // Integrasi mingguan
  const [monthlyBudgets, setMonthlyBudgets] = useState<Budget[]>([]);
  const [parentBudgetId, setParentBudgetId] = useState<string>("");
  const [weeklySourceCategory, setWeeklySourceCategory] = useState<string>("");
  const [loadingParents, setLoadingParents] = useState(false);

  useEffect(() => {
    getCategories("expense").then(setTxCategories).catch(() => { });
  }, []);

  useEffect(() => {
    if (period === "weekly" && !isEdit) {
      setLoadingParents(true);
      getBudgets()
        .then((data) => setMonthlyBudgets((data as Budget[]).filter((b) => b.period === "monthly")))
        .catch(() => { })
        .finally(() => setLoadingParents(false));
    }
  }, [period, isEdit]);

  const selectedParent = monthlyBudgets.find((b) => b.id === parentBudgetId);
  const parentCategories = selectedParent?.categories ?? [];

  useEffect(() => {
    if (!selectedParent || !weeklySourceCategory) return;
    const cat = parentCategories.find((c) => c.name.toLowerCase() === weeklySourceCategory.toLowerCase());
    if (cat) {
      const remaining = Math.max(0, Number(cat.planned_amount) - Number(cat.actual_amount));
      setTotalIncome(String(remaining));
    }
  }, [weeklySourceCategory, selectedParent]);

  useEffect(() => {
    if (!editData) return;
    setPeriod(editData.period);
    setName(editData.name);
    setTotalIncome(String(editData.total_income));
    setNotes(editData.notes ?? "");
    setParentBudgetId(editData.parent_budget_id ?? "");
    setWeeklySourceCategory(editData.weekly_source_category ?? "");
    setBudgetMonth(editData.month ?? now.getMonth() + 1);
    setBudgetYear(editData.year ?? now.getFullYear());
    setCategories(editData.categories.map((c, i) => ({
      id: c.id,
      name: c.name,
      planned_amount: String(c.planned_amount),
      actual_amount: Number(c.actual_amount) || 0,
      color: c.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      mapped_category_ids: (c.mapped_category_ids as string[]) ?? [],
      keyword_filter: c.keyword_filter ?? "",
      showMapping: !!((c.mapped_category_ids as string[])?.length),
    })));
  }, [editData]);

  const totalPlanned = categories.reduce((s, c) => s + (parseFloat(c.planned_amount) || 0), 0);
  const income = parseFloat(totalIncome) || 0;
  const remaining = income - totalPlanned;

  const linkedCatData = weeklySourceCategory && selectedParent
    ? parentCategories.find((c) => c.name.toLowerCase() === weeklySourceCategory.toLowerCase())
    : null;
  const linkedCatPercent = linkedCatData && Number(linkedCatData.planned_amount) > 0
    ? (Number(linkedCatData.actual_amount) / Number(linkedCatData.planned_amount)) * 100 : 0;

  const periodLabel = period === "monthly"
    ? `${MONTHS[budgetMonth - 1]} ${budgetYear}`
    : `Minggu ${Math.ceil(now.getDate() / 7)} ${MONTHS[budgetMonth - 1]} ${budgetYear}`;

  function addCategory() {
    setCategories((prev) => [...prev, {
      name: "", planned_amount: "", actual_amount: 0,
      color: CATEGORY_COLORS[prev.length % CATEGORY_COLORS.length],
      mapped_category_ids: [], keyword_filter: "", showMapping: false,
    }]);
  }

  function removeCategory(idx: number) {
    setCategories((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCat<K extends keyof CatRow>(idx: number, field: K, value: CatRow[K]) {
    setCategories((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function toggleMapping(idx: number) {
    setCategories((prev) => prev.map((c, i) => i === idx ? { ...c, showMapping: !c.showMapping } : c));
  }

  function toggleMappedCat(catIdx: number, txCatId: string) {
    setCategories((prev) => prev.map((c, i) => {
      if (i !== catIdx) return c;
      const already = c.mapped_category_ids.includes(txCatId);
      return {
        ...c,
        mapped_category_ids: already
          ? c.mapped_category_ids.filter((id) => id !== txCatId)
          : [...c.mapped_category_ids, txCatId],
      };
    }));
  }

  function handlePeriodChange(p: BudgetPeriod) {
    if (isEdit) return;
    setPeriod(p);
    setCategories(presetCats(p));
    setParentBudgetId(""); setWeeklySourceCategory("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cats = categories.filter((c) => c.name && parseFloat(c.planned_amount) > 0);
    if (cats.length === 0) { toast.error("Tambahkan minimal 1 kategori dengan nominal"); return; }
    if (!totalIncome || income <= 0) { toast.error("Total pemasukan wajib diisi"); return; }

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
            mapped_category_ids: c.mapped_category_ids.length > 0 ? c.mapped_category_ids : null,
            keyword_filter: c.keyword_filter || null,
          })),
        });
        toast.success("Budget berhasil diperbarui!");
      } else {
        const budgetName = name || `Budget ${period === "monthly" ? "Bulanan" : "Mingguan"} ${periodLabel}`;
        await addBudget({
          name: budgetName, period,
          year: budgetYear,
          month: period === "monthly" ? budgetMonth : undefined,
          week: period === "weekly" ? Math.ceil(now.getDate() / 7) : undefined,
          total_income: income,
          notes: notes || undefined,
          parent_budget_id: period === "weekly" && parentBudgetId ? parentBudgetId : null,
          weekly_source_category: period === "weekly" && weeklySourceCategory ? weeklySourceCategory : null,
          categories: cats.map((c) => ({
            name: c.name,
            planned_amount: parseFloat(c.planned_amount),
            color: c.color,
            mapped_category_ids: c.mapped_category_ids.length > 0 ? c.mapped_category_ids : null,
            keyword_filter: c.keyword_filter || null,
          })),
        });
        toast.success("Budget berhasil dibuat!");
      }
      onAdded();
    } catch { toast.error(isEdit ? "Gagal memperbarui budget" : "Gagal menyimpan budget"); }
    finally { setLoading(false); }
  }

  const ic = "w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-text-secondary transition-colors";
  const lc = "block text-xs font-medium text-text-secondary mb-1.5";
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-card border border-border rounded-xl shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{isEdit ? "Edit Budget" : "Buat Budget Baru"}</h2>
            <p className="text-xs text-text-secondary mt-0.5">Set rencana pengeluaran per kategori</p>
          </div>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Period */}
          <div>
            <label className={lc}>Tipe Periode {isEdit && <span className="text-accent">(tidak bisa diubah)</span>}</label>
            <div className="flex gap-2">
              {(["monthly", "weekly"] as BudgetPeriod[]).map((p) => (
                <button key={p} type="button" onClick={() => handlePeriodChange(p)} disabled={isEdit}
                  className={cn("flex-1 py-2 rounded-md text-sm font-medium border transition-colors",
                    period === p ? "bg-text-primary text-background border-text-primary" : "border-border text-text-secondary hover:border-accent",
                    isEdit && "opacity-60 cursor-not-allowed")}>
                  {p === "monthly" ? "Bulanan" : "Mingguan"}
                </button>
              ))}
            </div>
          </div>

          {/* Pilih bulan/tahun */}
          {period === "monthly" && (
            <div>
              <label className={lc}>Budget untuk bulan {isEdit && <span className="text-accent">(tidak bisa diubah)</span>}</label>
              <div className="flex gap-2">
                <select className={cn(ic, "flex-1 cursor-pointer")} value={budgetMonth}
                  onChange={(e) => setBudgetMonth(Number(e.target.value))} disabled={isEdit}>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <select className={cn(ic, "w-28 cursor-pointer")} value={budgetYear}
                  onChange={(e) => setBudgetYear(Number(e.target.value))} disabled={isEdit}>
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {!isEdit && (budgetMonth !== now.getMonth() + 1 || budgetYear !== now.getFullYear()) && (
                <p className="text-[10px] text-warning mt-1.5 flex items-center gap-1">
                  <AlertCircle size={10} /> Budget ini hanya terpotong oleh transaksi bertanggal {MONTHS[budgetMonth - 1]} {budgetYear}
                </p>
              )}
            </div>
          )}

          {/* Integrasi mingguan */}
          {period === "weekly" && !isEdit && (
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 size={13} className="text-accent shrink-0" />
                <p className="text-xs font-medium text-text-primary">Hubungkan ke Budget Bulanan (opsional)</p>
              </div>
              {loadingParents ? <p className="text-xs text-text-secondary">Memuat...</p>
                : monthlyBudgets.length === 0 ? <p className="text-xs text-text-secondary italic">Belum ada budget bulanan.</p>
                  : (
                    <>
                      <div>
                        <label className={lc}>Budget Bulanan</label>
                        <select className={cn(ic, "cursor-pointer")} value={parentBudgetId}
                          onChange={(e) => { setParentBudgetId(e.target.value); setWeeklySourceCategory(""); }}>
                          <option value="">— Tidak dihubungkan —</option>
                          {monthlyBudgets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      {parentBudgetId && (
                        <div>
                          <label className={lc}>Kategori yang dikhususkan untuk mingguan</label>
                          <select className={cn(ic, "cursor-pointer")} value={weeklySourceCategory}
                            onChange={(e) => setWeeklySourceCategory(e.target.value)}>
                            <option value="">— Pilih kategori —</option>
                            {parentCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      {linkedCatData && (
                        <div className={cn("rounded-md p-3 text-xs space-y-1", linkedCatPercent >= 100 ? "bg-danger/10 border border-danger/20" : "bg-success/10 border border-success/20")}>
                          <p className="font-medium text-text-primary">{linkedCatData.name}</p>
                          <div className="flex justify-between text-text-secondary">
                            <span>Sisa tersedia:</span>
                            <span className={cn("font-semibold", linkedCatPercent >= 100 ? "text-danger" : "text-success")}>
                              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
                                .format(Math.max(0, Number(linkedCatData.planned_amount) - Number(linkedCatData.actual_amount)))}
                            </span>
                          </div>
                          {linkedCatPercent >= 80 && <p className="text-[10px] text-warning">⚠️ Alokasi hampir habis!</p>}
                        </div>
                      )}
                    </>
                  )}
            </div>
          )}

          {/* Name */}
          <div>
            <label className={lc}>Nama Budget (opsional)</label>
            <input className={ic} placeholder={`Budget ${period === "monthly" ? "Bulanan" : "Mingguan"} ${periodLabel}`}
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Income */}
          <div>
            <label className={lc}>Total Pemasukan (Rp)
              {weeklySourceCategory && linkedCatData && <span className="text-accent ml-1">— dari sisa alokasi {weeklySourceCategory}</span>}
            </label>
            <input className={ic} type="number" min="0" placeholder="cth: 12450000"
              value={totalIncome} onChange={(e) => setTotalIncome(e.target.value)} required />
          </div>

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={cn(lc, "mb-0")}>Alokasi per Kategori</label>
              <button type="button" onClick={addCategory}
                className="flex items-center gap-1 text-xs text-accent hover:text-text-primary transition-colors">
                <Plus size={12} /> Tambah
              </button>
            </div>
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <div key={idx} className="border border-border rounded-lg overflow-hidden">
                  {/* Baris utama kategori */}
                  <div className="flex items-center gap-2 p-2">
                    <input type="color" value={cat.color}
                      onChange={(e) => updateCat(idx, "color", e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent shrink-0" />
                    <input className={cn(ic, "flex-1 border-0 bg-transparent px-1 focus:bg-surface rounded")}
                      placeholder="Nama kategori" value={cat.name}
                      onChange={(e) => updateCat(idx, "name", e.target.value)} />
                    <input className={cn(ic, "w-32 border-0 bg-transparent px-1 focus:bg-surface rounded")}
                      type="number" min="0" placeholder="Rp" value={cat.planned_amount}
                      onChange={(e) => updateCat(idx, "planned_amount", e.target.value)} />
                    {/* Tombol mapping */}
                    <button type="button" onClick={() => toggleMapping(idx)}
                      title="Set mapping kategori transaksi"
                      className={cn("p-1 rounded transition-colors shrink-0",
                        cat.showMapping || cat.mapped_category_ids.length > 0
                          ? "text-text-primary" : "text-accent hover:text-text-primary")}>
                      {cat.showMapping ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <button type="button" onClick={() => removeCategory(idx)}
                      className="text-accent hover:text-danger transition-colors shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Panel mapping — expandable */}
                  {cat.showMapping && (
                    <div className="border-t border-border bg-surface px-3 py-3 space-y-3">
                      <div>
                        <p className="text-[11px] font-medium text-text-primary mb-1">
                          Tangkap dari kategori transaksi:
                        </p>
                        <p className="text-[10px] text-text-secondary mb-2">
                          Transaksi dengan kategori yang dicentang akan otomatis masuk ke budget kategori ini.
                        </p>
                        {txCategories.length === 0 ? (
                          <p className="text-[10px] text-accent italic">Belum ada kategori transaksi.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {txCategories.map((tc) => {
                              const checked = cat.mapped_category_ids.includes(tc.id);
                              return (
                                <button key={tc.id} type="button"
                                  onClick={() => toggleMappedCat(idx, tc.id)}
                                  className={cn(
                                    "px-2 py-1 rounded-full text-[11px] font-medium border transition-colors",
                                    checked
                                      ? "bg-text-primary text-background border-text-primary"
                                      : "border-border text-text-secondary hover:border-accent"
                                  )}>
                                  {checked && "✓ "}{tc.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Keyword filter — muncul kalau sudah ada mapping */}
                      {cat.mapped_category_ids.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-medium text-text-secondary mb-1">
                            Filter kata kunci <span className="font-normal text-accent">(opsional)</span>
                          </label>
                          <input
                            className={cn(ic, "text-xs py-1.5")}
                            placeholder='cth: "KPR", "motor", "Netflix"'
                            value={cat.keyword_filter}
                            onChange={(e) => updateCat(idx, "keyword_filter", e.target.value)}
                          />
                          <p className="text-[10px] text-text-secondary mt-1">
                            Hanya transaksi yang <span className="font-medium">namanya mengandung kata ini</span> yang akan masuk ke sini. Kosongkan untuk tangkap semua.
                          </p>
                        </div>
                      )}

                      {/* Ringkasan mapping */}
                      {cat.mapped_category_ids.length > 0 && (
                        <div className="text-[10px] text-success bg-success/10 rounded px-2 py-1.5">
                          ✓ Menangkap: <span className="font-medium">
                            {cat.mapped_category_ids.map((id) => txCategories.find((t) => t.id === id)?.name ?? id).join(", ")}
                          </span>
                          {cat.keyword_filter && <> · kata kunci "<span className="font-medium">{cat.keyword_filter}</span>"</>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          {income > 0 && (
            <div className="bg-surface rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Total direncanakan</span>
                <span className="text-text-primary font-medium">
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(totalPlanned)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Sisa income</span>
                <span className={cn("font-semibold", remaining >= 0 ? "text-success" : "text-danger")}>
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(remaining)}
                </span>
              </div>
              {remaining < 0 && <p className="text-[10px] text-danger">⚠️ Total alokasi melebihi pemasukan!</p>}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={lc}>Catatan (opsional)</label>
            <textarea className={cn(ic, "resize-none")} rows={2}
              placeholder="cth: Fokus kurangi makan di luar bulan ini"
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

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