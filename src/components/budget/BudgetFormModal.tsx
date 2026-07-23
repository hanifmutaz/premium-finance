"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Loader2, Link2, AlertCircle } from "lucide-react";
import { cn } from "@/utils";
import { addBudget, updateBudget, getBudgets } from "@/lib/db";
import { toast } from "sonner";
import type { Budget, BudgetPeriod } from "@/types";

const CATEGORY_COLORS = [
  "#64748B", "#475569", "#334155", "#94A3B8", "#22C55E",
  "#F59E0B", "#8B5CF6", "#EC4899", "#3B82F6", "#EF4444",
];

const PRESET_CATEGORIES_MONTHLY = [
  "Motor", "Belanja", "Kost", "UKT",
  "Minggu 1", "Minggu 2", "Minggu 3", "Minggu 4",
];
const PRESET_CATEGORIES_WEEKLY = [
  "Transport", "Roko", "Kopi", "Lainnya",
];

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface CatRow {
  id?: string;
  name: string;
  planned_amount: string;
  actual_amount: number;
  color: string;
  mapped_category_ids: string[];
  keyword_filter: string;
  // Kalau diisi, kategori ini "warisan" dari kategori bulanan induk —
  // mapping (mapped_category_ids/keyword_filter) di-resolve otomatis di
  // server dari kategori itu, gak perlu di-setup manual lagi di sini.
  parent_budget_category_id: string | null;
}

// Rentang tanggal Senin-Minggu (kalender asli) yang meliputi tanggal `d`.
function calendarWeekRange(d: Date): { start: Date; end: Date } {
  const day = d.getDay(); // 0 = Minggu, 1 = Senin, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start, end };
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
      mapped_category_ids: [], keyword_filter: "",
      parent_budget_category_id: null,
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
  const [budgetWeek, setBudgetWeek] = useState(Math.ceil(now.getDate() / 7));
  // Rentang tanggal minggu asli (Senin-Minggu) — sumber utama buat matching
  // transaksi, gak lagi cuma "hari-ke-N / 7" yang gak match kalender beneran.
  const defaultWeekRange = calendarWeekRange(now);
  const [startDate, setStartDate] = useState(toISODate(defaultWeekRange.start));
  const [endDate, setEndDate] = useState(toISODate(defaultWeekRange.end));

  // Integrasi mingguan
  const [monthlyBudgets, setMonthlyBudgets] = useState<Budget[]>([]);
  const [existingWeeklyBudgets, setExistingWeeklyBudgets] = useState<Budget[]>([]);
  const [parentBudgetId, setParentBudgetId] = useState<string>("");
  const [weeklySourceCategory, setWeeklySourceCategory] = useState<string>("");
  const [loadingParents, setLoadingParents] = useState(false);

  useEffect(() => {
    if (period === "weekly") {
      setLoadingParents(true);
      getBudgets()
        .then((data) => {
          const all = data as Budget[];
          setMonthlyBudgets(all.filter((b) => b.period === "monthly"));
          setExistingWeeklyBudgets(all.filter((b) => b.period === "weekly"));
        })
        .catch(() => { })
        .finally(() => setLoadingParents(false));
    }
  }, [period]);

  // Budget mingguan lain yang rentang tanggalnya overlap sama yang lagi
  // diisi — kalau ada, transaksi bakal ke-hitung DOBEL di keduanya (lihat
  // penjelasan di chat), jadi diperingatin di UI, bukan cuma pas submit.
  const overlappingWeekly = period === "weekly" && !isEdit && startDate && endDate
    ? existingWeeklyBudgets.filter((b) =>
      b.start_date && b.end_date && b.start_date <= endDate && b.end_date >= startDate
    )
    : [];

  // budgetWeek cuma dipertahankan buat kolom legacy `week` (backward compat).
  // start_date/end_date di atas adalah sumber utama, jadi gak ada kontrol
  // terpisah buat ini di UI — cukup diturunkan dari startDate.
  useEffect(() => {
    if (period !== "weekly") return;
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return;
    setBudgetWeek(Math.ceil(d.getDate() / 7));
  }, [startDate, period]);

  const selectedParent = monthlyBudgets.find((b) => b.id === parentBudgetId);
  const parentCategories = selectedParent?.categories ?? [];

  // NOTE: auto-fill totalIncome + auto-link kategori sekarang dilakuin
  // langsung di onChange dropdown-nya (bukan react ke state lewat effect
  // kayak dulu) — supaya waktu data lama di-hydrate pas Edit (parentBudgetId
  // /weeklySourceCategory ke-set dari editData), ini GAK ikut ke-trigger dan
  // gak nimpa total_income/parent link yang udah kesimpen bener.

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
    setBudgetWeek(editData.week ?? Math.ceil(now.getDate() / 7));
    if (editData.start_date && editData.end_date) {
      setStartDate(editData.start_date);
      setEndDate(editData.end_date);
    } else if (editData.period === "weekly" && editData.week && editData.month && editData.year) {
      // Data lama belum di-backfill (belum jalanin migration 005) — hitung dari logic lama
      const dayStart = (editData.week - 1) * 7 + 1;
      const monthEndDay = new Date(editData.year, editData.month, 0).getDate();
      const dayEnd = Math.min(editData.week * 7, monthEndDay);
      setStartDate(toISODate(new Date(editData.year, editData.month - 1, dayStart)));
      setEndDate(toISODate(new Date(editData.year, editData.month - 1, dayEnd)));
    }
    setCategories(editData.categories.map((c, i) => ({
      id: c.id,
      name: c.name,
      planned_amount: String(c.planned_amount),
      actual_amount: Number(c.actual_amount) || 0,
      color: c.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      mapped_category_ids: (c.mapped_category_ids as string[]) ?? [],
      keyword_filter: c.keyword_filter ?? "",
      parent_budget_category_id: (c as { parent_budget_category_id?: string | null }).parent_budget_category_id ?? null,
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
    : `Minggu ${budgetWeek} ${MONTHS[budgetMonth - 1]} ${budgetYear}`;

  function addCategory() {
    setCategories((prev) => [...prev, {
      name: "", planned_amount: "", actual_amount: 0,
      color: CATEGORY_COLORS[prev.length % CATEGORY_COLORS.length],
      mapped_category_ids: [], keyword_filter: "",
      parent_budget_category_id: null,
    }]);
  }

  // Kalau kategori mingguan ini "warisan" dari kategori bulanan induk, gak
  // perlu setup mapping manual lagi — server resolve otomatis dari sana.
  function setCatParent(idx: number, parentCatId: string) {
    setCategories((prev) => prev.map((c, i) => i === idx ? {
      ...c,
      parent_budget_category_id: parentCatId || null,
      mapped_category_ids: parentCatId ? [] : c.mapped_category_ids,
      keyword_filter: parentCatId ? "" : c.keyword_filter,
    } : c));
  }

  // Dipanggil pas user MEMILIH (bukan pas hydration dari editData) kategori
  // bulanan di section "Hubungkan ke Budget Bulanan". Sekali pilih di sini,
  // SEMUA baris kategori mingguan di bawah otomatis ke-link ke kategori
  // bulanan itu (gak perlu lagi konfigurasi satu-satu per baris) — user
  // masih bisa override baris tertentu manual sesudahnya lewat dropdown
  // "Bagian dari kategori bulanan" di baris itu kalau memang ada
  // pengecualian.
  function handleWeeklySourceCategoryChange(catName: string, catList: { id: string; name: string; planned_amount: number; actual_amount: number }[]) {
    setWeeklySourceCategory(catName);
    if (!catName) {
      setCategories((prev) => prev.map((c) => ({ ...c, parent_budget_category_id: null })));
      return;
    }
    const cat = catList.find((c) => c.name.toLowerCase() === catName.toLowerCase());
    if (!cat) return;
    setTotalIncome(String(Math.max(0, Number(cat.planned_amount) - Number(cat.actual_amount))));
    setCategories((prev) => prev.map((c) => ({ ...c, parent_budget_category_id: cat.id })));
  }

  function removeCategory(idx: number) {
    setCategories((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCat<K extends keyof CatRow>(idx: number, field: K, value: CatRow[K]) {
    setCategories((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function handlePeriodChange(p: BudgetPeriod) {
    if (isEdit) return;
    setPeriod(p);
    setCategories(presetCats(p));
    setParentBudgetId(""); setWeeklySourceCategory("");
    if (p === "weekly") {
      const { start, end } = calendarWeekRange(now);
      setStartDate(toISODate(start)); setEndDate(toISODate(end));
      setBudgetMonth(start.getMonth() + 1); setBudgetYear(start.getFullYear());
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cats = categories.filter((c) => c.name && parseFloat(c.planned_amount) > 0);
    if (cats.length === 0) { toast.error("Tambahkan minimal 1 kategori dengan nominal"); return; }
    if (!totalIncome || income <= 0) { toast.error("Total pemasukan wajib diisi"); return; }

    // Cek tabrakan rollup: kalau 2+ kategori mingguan sama-sama "ambil dari
    // kategori bulanan" yang SAMA, actual_amount kategori bulanan itu bakal
    // ke-hitung dobel pas rollup (dijumlah dua kali). Diperingatin dari awal.
    const collisions: string[] = [];
    for (let i = 0; i < cats.length; i++) {
      for (let j = i + 1; j < cats.length; j++) {
        if (cats[i].parent_budget_category_id && cats[i].parent_budget_category_id === cats[j].parent_budget_category_id) {
          collisions.push(`"${cats[i].name}" & "${cats[j].name}" (sama-sama ambil dari kategori bulanan yang sama)`);
        }
      }
    }
    if (collisions.length > 0) {
      const proceed = window.confirm(
        `Ada kategori yang rollup ke kategori bulanan yang sama: ${collisions.join(", ")}. ` +
        `Ini bakal ke-hitung dobel di total bulanannya. Lanjut simpan begini?`
      );
      if (!proceed) return;
    }

    setLoading(true);
    try {
      if (isEdit && editData) {
        await updateBudget(editData.id, {
          name: name || editData.name,
          total_income: income,
          notes: notes || undefined,
          // Weekly boleh diubah (dulu gak pernah ke-set sama sekali — ini jalan buat benerin data lama).
          // Monthly tetap dikunci di UI (select disabled), jadi nilainya konsisten sama sebelumnya.
          year: budgetYear,
          month: budgetMonth,
          week: period === "weekly" ? budgetWeek : null,
          start_date: period === "weekly" ? startDate : null,
          end_date: period === "weekly" ? endDate : null,
          parent_budget_id: period === "weekly" && parentBudgetId ? parentBudgetId : null,
          weekly_source_category: period === "weekly" && weeklySourceCategory ? weeklySourceCategory : null,
          categories: cats.map((c) => ({
            id: c.id,
            name: c.name,
            planned_amount: parseFloat(c.planned_amount),
            actual_amount: c.actual_amount,
            color: c.color,
            mapped_category_ids: c.mapped_category_ids.length > 0 ? c.mapped_category_ids : null,
            keyword_filter: c.keyword_filter || null,
            parent_budget_category_id: c.parent_budget_category_id,
          })),
        });
        toast.success("Budget berhasil diperbarui!");
      } else {
        const budgetName = name || `Budget ${period === "monthly" ? "Bulanan" : "Mingguan"} ${periodLabel}`;
        await addBudget({
          name: budgetName, period,
          year: budgetYear,
          month: budgetMonth, // dulu: undefined buat weekly — makanya gak pernah ke-sync
          week: period === "weekly" ? budgetWeek : undefined, // dulu: dihitung dari tanggal HARI INI, bukan pilihan user
          start_date: period === "weekly" ? startDate : null,
          end_date: period === "weekly" ? endDate : null,
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
            parent_budget_category_id: c.parent_budget_category_id,
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

          {/* Pilih bulan/tahun (monthly), atau rentang tanggal asli (weekly) */}
          <div>
            <label className={lc}>
              Budget untuk {period === "monthly" ? "bulan" : "rentang tanggal"}
              {period === "monthly" && isEdit && <span className="text-accent"> (tidak bisa diubah)</span>}
            </label>
            {period === "monthly" ? (
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
            ) : (
              <>
                <div className="flex gap-2 items-center">
                  <input type="date" className={cn(ic, "flex-1 cursor-pointer")} value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      const d = new Date(e.target.value);
                      setBudgetMonth(d.getMonth() + 1); setBudgetYear(d.getFullYear());
                    }} />
                  <span className="text-xs text-text-secondary shrink-0">s/d</span>
                  <input type="date" className={cn(ic, "flex-1 cursor-pointer")} value={endDate}
                    onChange={(e) => setEndDate(e.target.value)} min={startDate} />
                </div>
                <button type="button"
                  className="text-[10px] text-accent hover:text-text-primary transition-colors mt-1.5"
                  onClick={() => {
                    const { start, end } = calendarWeekRange(now);
                    setStartDate(toISODate(start)); setEndDate(toISODate(end));
                    setBudgetMonth(start.getMonth() + 1); setBudgetYear(start.getFullYear());
                  }}>
                  Pakai minggu ini (Senin–Minggu)
                </button>
                <p className="text-[10px] text-text-secondary mt-1">
                  Rentang tanggal asli — bebas dipilih, gak harus ngikut batas bulan kalender.
                </p>
                {overlappingWeekly.length > 0 && (
                  <p className="flex items-start gap-1.5 text-[10px] text-warning mt-1.5 bg-warning/10 rounded px-2 py-1.5">
                    <AlertCircle size={11} className="shrink-0 mt-px" />
                    Rentang ini overlap sama {overlappingWeekly.map((b) => `"${b.name}"`).join(", ")}.
                    Transaksi di tanggal yang sama bakal ke-hitung DOBEL di kedua budget, bukan kesebar.
                    Kalau maksudnya breakdown kategori (bensin/makan/lainnya) buat minggu yang sama,
                    lebih baik ditaruh sebagai kategori dalam SATU budget ini aja.
                  </p>
                )}
              </>
            )}
            {period === "monthly" && !isEdit && (budgetMonth !== now.getMonth() + 1 || budgetYear !== now.getFullYear()) && (
              <p className="text-[10px] text-warning mt-1.5 flex items-center gap-1">
                <AlertCircle size={10} /> Budget ini hanya terpotong oleh transaksi bertanggal {MONTHS[budgetMonth - 1]} {budgetYear}
              </p>
            )}
          </div>

          {/* Integrasi mingguan — bisa direconfigure pas Edit juga sekarang,
              dulu section ini ilang total begitu budget-nya udah ke-save. */}
          {period === "weekly" && (
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
                          onChange={(e) => {
                            setParentBudgetId(e.target.value);
                            setWeeklySourceCategory("");
                            setCategories((prev) => prev.map((c) => ({ ...c, parent_budget_category_id: null })));
                          }}>
                          <option value="">— Tidak dihubungkan —</option>
                          {monthlyBudgets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      {parentBudgetId && (
                        <div>
                          <label className={lc}>Kategori yang dikhususkan untuk mingguan</label>
                          <select className={cn(ic, "cursor-pointer")} value={weeklySourceCategory}
                            onChange={(e) => handleWeeklySourceCategoryChange(e.target.value, parentCategories)}>
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
                    <button type="button" onClick={() => removeCategory(idx)}
                      className="text-accent hover:text-danger transition-colors shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Kalau budget mingguan ini nempel ke budget bulanan, kategori bisa "warisan"
                      link ke kategori bulanan induk — ini BUKAN buat matching transaksi (itu
                      udah digantiin assignment eksplisit di halaman Transaksi), tapi biar
                      actual_amount kategori BULANAN otomatis roll-up dari total kategori
                      mingguan-mingguan di bawahnya. */}
                  {period === "weekly" && parentBudgetId && parentCategories.length > 0 && (
                    <div className="border-t border-border bg-surface px-3 py-2.5">
                      <label className="text-[10px] text-text-secondary flex items-center gap-1 mb-1">
                        <Link2 size={11} className="shrink-0" /> Bagian dari kategori bulanan (opsional)
                      </label>
                      <select className={cn(ic, "text-xs py-1.5 cursor-pointer")}
                        value={cat.parent_budget_category_id ?? ""}
                        onChange={(e) => setCatParent(idx, e.target.value)}>
                        <option value="">— Berdiri sendiri —</option>
                        {parentCategories.map((pc) => <option key={pc.id} value={pc.id}>{pc.name}</option>)}
                      </select>
                      {cat.parent_budget_category_id && (
                        <p className="text-[10px] text-success mt-1.5">
                          ✓ Realisasi kategori{" "}
                          <span className="font-medium">
                            {parentCategories.find((pc) => pc.id === cat.parent_budget_category_id)?.name}
                          </span>{" "}
                          di budget bulanan bakal ikut total dari sini.
                        </p>
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