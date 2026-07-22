"use client";

import { useState, useEffect } from "react";
import { X, Loader2, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  cn,
  formatInputNumber,
  parseInputNumber,
  formatCurrency,
} from "@/utils";
import {
  addTransaction,
  updateTransaction,
  getCategories,
  addCategory,
  getAccounts,
  getBudgets,
} from "@/lib/db";
import type {
  Transaction,
  TransactionType,
  PaymentMethod,
  AccountWithBalance,
  Budget,
} from "@/types";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "transfer", label: "Transfer Bank" },
  { value: "cash", label: "Tunai" },
  { value: "credit_card", label: "Kartu Kredit" },
  { value: "debit_card", label: "Kartu Debit" },
  { value: "e-wallet", label: "E-Wallet" },
  { value: "other", label: "Lainnya" },
];

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
  open: boolean;
  onClose: () => void;
  editData?: Transaction | null;
}

function emptyForm() {
  return {
    name: "",
    description: "",
    category_id: "",
    amountDisplay: "",
    amountRaw: "",
    account_id: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "transfer" as PaymentMethod,
  };
}

export function TransactionFormModal({ open, onClose, editData }: Props) {
  const isEdit = !!editData;
  const now = new Date();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [budgetCategoryId, setBudgetCategoryId] = useState<string>("");
  const [categoryAutoFilled, setCategoryAutoFilled] = useState(false);
  // Periode budget yang lagi ditampilin di picker — SENGAJA independen dari
  // form.date. Kasus nyata: belanja bulanan tgl 30 Juni itu transaksinya
  // beneran tanggal 30 Juni (jangan diubah), tapi mau dipotong dari budget
  // BULAN DEPAN (Juli). Kalau ini di-derive dari form.date, kasus itu gak
  // mungkin — makanya dipisah, ada tombol geser bulan sendiri di picker.
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setType(editData.type);
      const raw = String(editData.amount);
      setForm({
        name: editData.name,
        description: editData.description ?? "",
        category_id: editData.category_id ?? "",
        amountRaw: raw,
        amountDisplay: formatInputNumber(raw),
        account_id: editData.account_id ?? "",
        date: editData.date,
        payment_method: editData.payment_method,
      });
      setBudgetCategoryId(editData.budget_category_id ?? "");
      setCategoryAutoFilled(false);
      const d = new Date(editData.date);
      setPickerYear(d.getFullYear());
      setPickerMonth(d.getMonth() + 1);
    } else {
      setType("expense");
      setForm(emptyForm());
      setBudgetCategoryId("");
      setCategoryAutoFilled(false);
      const d = new Date();
      setPickerYear(d.getFullYear());
      setPickerMonth(d.getMonth() + 1);
    }
  }, [open, editData]);

  function shiftPickerMonth(delta: number) {
    const d = new Date(pickerYear, pickerMonth - 1 + delta, 1);
    setPickerYear(d.getFullYear());
    setPickerMonth(d.getMonth() + 1);
    // NOTE: budgetCategoryId sengaja TIDAK di-clear langsung di sini lagi.
    // Dulu di-clear tiap geser bulan, tapi itu juga ngehapus assignment yang
    // MASIH VALID kalau user cuma iseng geser buat liat-liat lalu balik lagi
    // ke bulan yang sama, atau kalau kategori yang lagi ke-assign justru ada
    // di bulan baru yang dituju. Validasi (masih ada di opsi bulan ini atau
    // nggak) dilakuin di effect di bawah, sesudah `budgets` beneran ke-load.
  }

  // Pilih kategori budget dari picker + auto-isi field "Kategori" (buat
  // Reports) biar user gak perlu pilih dua kali. Kalau kategori dengan nama
  // yang sama belum ada di tabel categories, dibikinin otomatis — jadi gak
  // perlu setup manual sama sekali. Tetep bisa di-override manual sesudahnya.
  async function handlePickBudgetCategory(c: { id: string; name: string }) {
    setBudgetCategoryId(c.id);
    const existing = categories.find((cat) => cat.name.toLowerCase() === c.name.toLowerCase());
    if (existing) {
      setForm((f) => ({ ...f, category_id: existing.id }));
      setCategoryAutoFilled(true);
      return;
    }
    try {
      const created = await addCategory({ name: c.name, type: "expense" });
      setCategories((prev) => [...prev, created]);
      setForm((f) => ({ ...f, category_id: created.id }));
      setCategoryAutoFilled(true);
    } catch {
      // Gagal bikin kategori baru (jarang) — biarin user pilih manual, gak fatal.
    }
  }

  useEffect(() => {
    if (open)
      getAccounts()
        .then(setAccounts)
        .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) {
      getCategories(type === "income" ? "income" : "expense")
        .then(setCategories)
        .catch(() => {});
    }
  }, [open, type]);

  useEffect(() => {
    if (open && (type === "expense" || type === "debt_payment")) {
      getBudgets()
        .then((data) => setBudgets(data as Budget[]))
        .catch(() => {});
    }
  }, [open, type]);

  useEffect(() => {
    if (type !== "expense" && type !== "debt_payment") setBudgetCategoryId("");
  }, [type]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInputNumber(e.target.value);
    setForm((f) => ({
      ...f,
      amountRaw: raw,
      amountDisplay: formatInputNumber(raw),
    }));
  }

  const isExpenseType = type === "expense" || type === "debt_payment" || type === "saving";

  // Budget mingguan mencakup tanggal transaksi kalau: punya start_date/end_date
  // eksplisit yang nyakup tanggal itu (row baru, lihat migration 005), ATAU
  // (fallback row lama) month+tahun sama & week = ceil(tgl/7).
  function weeklyCoversDate(b: Budget, dateStr: string): boolean {
    if (b.start_date && b.end_date) return dateStr >= b.start_date && dateStr <= b.end_date;
    if (!b.week || !b.month) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === b.year && d.getMonth() + 1 === b.month && Math.ceil(d.getDate() / 7) === b.week;
  }

  const relevantMonthly = budgets.find(
    (b) => b.period === "monthly" && b.month === pickerMonth && b.year === pickerYear,
  );

  const weeklyChildren = budgets
    .filter((b) => b.period === "weekly" && relevantMonthly && b.parent_budget_id === relevantMonthly.id)
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));

  // Weekly berdiri sendiri (gak punya parent budget bulanan) — ikutin bulan
  // picker juga (dari start_date, atau month/week buat row lama), bukan
  // "nyakup tanggal transaksi" lagi.
  function weeklyBelongsToPeriod(b: Budget, year: number, month: number): boolean {
    if (b.start_date) {
      const d = new Date(b.start_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }
    return b.year === year && b.month === month;
  }
  const standaloneWeekly = budgets.filter(
    (b) => b.period === "weekly" && !b.parent_budget_id && weeklyBelongsToPeriod(b, pickerYear, pickerMonth),
  );

  // Kategori bulanan yang JADI INDUK dari salah satu kategori mingguan di
  // atas gak ditampilin sebagai opsi sendiri — actual_amount-nya rollup
  // otomatis dari anak-anaknya, jadi gak perlu (dan gak boleh) di-assign
  // transaksi langsung ke situ juga (bisa dobel-hitung).
  const childParentIds = new Set(
    weeklyChildren.flatMap((b) => b.categories.map((c) => c.parent_budget_category_id).filter(Boolean)),
  );
  const directMonthlyCats = relevantMonthly
    ? relevantMonthly.categories.filter((c) => !childParentIds.has(c.id))
    : [];

  const hasAnyBudgets = isExpenseType && budgets.some((b) => b.period === "monthly" || b.period === "weekly");

  // Cari bulan/tahun ASLI tempat sebuah budget_category_id kepake, dengan
  // nelusurin budgets yang udah ke-load. Weekly yang punya parent ikut bulan
  // si induk (bulanan); weekly standalone ikut start_date/month-year-nya
  // sendiri. Dipake buat betulin pickerMonth/pickerYear pas edit transaksi
  // yang eksplisit ke-assign ke kategori di bulan LAIN dari tanggal
  // transaksinya sendiri (fitur "beli tgl 30 Juni, potong budget Juli").
  function findPeriodForCategory(catId: string, list: Budget[]): { year: number; month: number } | null {
    const owner = list.find((b) => b.categories.some((c) => c.id === catId));
    if (!owner) return null;
    if (owner.period === "monthly" && owner.month) return { year: owner.year, month: owner.month };
    if (owner.parent_budget_id) {
      const parent = list.find((b) => b.id === owner.parent_budget_id);
      if (parent && parent.month) return { year: parent.year, month: parent.month };
    }
    if (owner.start_date) {
      const d = new Date(owner.start_date);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
    if (owner.month) return { year: owner.year, month: owner.month };
    return null;
  }

  // Sekali budgets ke-load pas lagi edit transaksi yang punya budget_category_id
  // eksplisit, betulin pickerMonth/Year ke bulan ASLI kategori itu (bukan
  // sekadar bulan tanggal transaksi) — biar kategorinya kebaca "valid" dan
  // gak ke-clear sama effect validasi di bawah.
  useEffect(() => {
    if (!open || !editData?.budget_category_id || budgets.length === 0) return;
    const period = findPeriodForCategory(editData.budget_category_id, budgets);
    if (period) {
      setPickerYear(period.year);
      setPickerMonth(period.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editData, budgets]);

  // Validasi budgetCategoryId tiap kali bulan picker atau data budgets
  // berubah. Cuma clear kalau kategori yang lagi ke-assign BENERAN gak ada di
  // opsi bulan yang lagi ditampilin sekarang — bukan blind-clear kayak dulu.
  // Skip selama budgets belum ke-load (array masih kosong) biar gak salah
  // nge-clear assignment yang valid cuma gara-gara datanya belum nyampe.
  useEffect(() => {
    if (!budgetCategoryId) return;
    if (budgets.length === 0) return;
    const validIds = new Set([
      ...weeklyChildren.flatMap((b) => b.categories.map((c) => c.id)),
      ...standaloneWeekly.flatMap((b) => b.categories.map((c) => c.id)),
      ...directMonthlyCats.map((c) => c.id),
    ]);
    if (!validIds.has(budgetCategoryId)) {
      setBudgetCategoryId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerMonth, pickerYear, budgets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.amountRaw) {
      toast.error("Nama dan nominal wajib diisi");
      return;
    }
    const amount = parseFloat(form.amountRaw);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Nominal tidak valid");
      return;
    }

    setLoading(true);
    try {
      if (isEdit && editData) {
        await updateTransaction(editData.id, {
          type,
          name: form.name,
          description: form.description || undefined,
          category_id: form.category_id || undefined,
          amount,
          account_id:
            type !== "transfer" ? form.account_id || undefined : undefined,
          date: form.date,
          payment_method: form.payment_method,
          budget_category_id: budgetCategoryId || null,
        });
        toast.success("Transaksi berhasil diperbarui");
      } else {
        await addTransaction(
          {
            type,
            name: form.name,
            description: form.description || undefined,
            category_id: form.category_id || undefined,
            amount,
            account_id:
              type !== "transfer" ? form.account_id || undefined : undefined,
            date: form.date,
            payment_method: form.payment_method,
            status: "completed",
          },
          null,
          budgetCategoryId || null,
        );
        toast.success("Transaksi berhasil ditambahkan");
      }
      setForm(emptyForm());
      setBudgetCategoryId("");
      onClose();
    } catch {
      toast.error(
        isEdit ? "Gagal memperbarui transaksi" : "Gagal menyimpan transaksi",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors";
  const labelClass = "block text-xs text-text-secondary mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md bg-surface-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface-card">
          <h2 className="text-sm font-semibold text-text-primary">
            {isEdit ? "Edit Transaksi" : "Tambah Transaksi"}
          </h2>
          <button
            onClick={onClose}
            className="text-accent hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface rounded-lg">
            {(
              [
                "income",
                "expense",
                "debt_payment",
                "transfer",
                "saving",
                // "receivable_out" sengaja gak dimasukin di sini — transaksi
                // tipe ini cuma boleh dibuat otomatis lewat halaman Piutang
                // (addReceivable), biar selalu nyambung ke satu record
                // receivables. Bikin manual dari sini bisa bikin transaksi
                // "piutang keluar" yatim tanpa catatan piutangnya.
              ] as const
            ).map((t) => {
              const labels = {
                income: "Masuk",
                expense: "Keluar",
                debt_payment: "Utang",
                transfer: "Transfer",
                saving: "Nabung",
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
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>

          {/* Name */}
          <div>
            <label className={labelClass}>Nama Transaksi *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="mis. Gaji Juli, Bayar Listrik..."
              className={inputClass}
            />
          </div>

          {/* Amount — formatted dengan titik ribuan, tapi value-nya angka bersih */}
          <div>
            <label className={labelClass}>Nominal *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm font-medium">
                Rp
              </span>
              <input
                inputMode="numeric"
                value={form.amountDisplay}
                onChange={handleAmountChange}
                placeholder="0"
                className={cn(inputClass, "pl-9 tabular-nums")}
              />
            </div>
            {/* Preview formatted kalau udah ada nilai */}
            {form.amountRaw && Number(form.amountRaw) > 0 && (
              <p className="text-[11px] text-text-secondary mt-1 tabular-nums">
                = {formatCurrency(Number(form.amountRaw))}
              </p>
            )}
          </div>

          {/* Date & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tanggal</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={cn(labelClass, "flex items-center gap-1")}>
                Kategori
                {categoryAutoFilled && (
                  <span className="text-success font-normal normal-case">· otomatis dari budget</span>
                )}
              </label>
              <select
                value={form.category_id}
                onChange={(e) => {
                  setForm({ ...form, category_id: e.target.value });
                  setCategoryAutoFilled(false);
                }}
                className={inputClass}
              >
                <option value="">Pilih kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign ke kategori budget */}
          {hasAnyBudgets && (
            <div>
              <label className={cn(labelClass, "flex items-center gap-1.5")}>
                <BookOpen size={11} className="text-accent" />
                Masukkan ke budget
                <span className="text-accent">(opsional)</span>
              </label>

              {/* Navigasi bulan budget — SENGAJA terpisah dari tanggal transaksi
                  di atas. Contoh: belanja tgl 30 Juni buat jatah bulan Juli →
                  tanggal transaksi tetap 30 Juni, geser panel ini ke Juli. */}
              <div className="flex items-center justify-between mb-1.5 px-1">
                <button type="button" onClick={() => shiftPickerMonth(-1)} className="text-accent hover:text-text-primary p-1">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-medium text-text-primary">
                  {MONTHS[pickerMonth - 1]} {pickerYear}
                </span>
                <button type="button" onClick={() => shiftPickerMonth(1)} className="text-accent hover:text-text-primary p-1">
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
                {/* Opsi default: gak di-assign, tetap auto-match kayak biasa */}
                <label className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-surface">
                  <input
                    type="radio"
                    name="budgetCategoryId"
                    checked={budgetCategoryId === ""}
                    onChange={() => { setBudgetCategoryId(""); setCategoryAutoFilled(false); }}
                  />
                  <span className="text-text-secondary">Otomatis (sesuai tanggal &amp; kategori)</span>
                </label>

                {weeklyChildren.length === 0 && standaloneWeekly.length === 0 && directMonthlyCats.length === 0 && (
                  <p className="px-3 py-2.5 text-[11px] text-accent italic">
                    Gak ada budget di {MONTHS[pickerMonth - 1]} {pickerYear}.
                  </p>
                )}

                {relevantMonthly && weeklyChildren.length > 0 && (
                  <div className="px-3 py-1.5 bg-surface text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                    {MONTHS[(relevantMonthly.month ?? 1) - 1]} {relevantMonthly.year} · Budget Mingguan
                  </div>
                )}
                {weeklyChildren.map((wb, i) => {
                  const isCurrentWeek = weeklyCoversDate(wb, form.date);
                  return (
                    <div key={wb.id}>
                      <div className={cn(
                        "px-3 pt-2 pb-1 text-[10px] font-medium flex items-center gap-1.5",
                        isCurrentWeek ? "text-text-primary" : "text-text-secondary",
                      )}>
                        Minggu {i + 1}
                        {wb.start_date && wb.end_date && (
                          <span className="text-accent font-normal">
                            {new Date(wb.start_date).getDate()}–{new Date(wb.end_date).getDate()} {MONTHS[new Date(wb.end_date).getMonth()]}
                          </span>
                        )}
                        {isCurrentWeek && (
                          <span className="text-[9px] bg-success/15 text-success px-1.5 py-0.5 rounded-full">tgl transaksi masuk sini</span>
                        )}
                      </div>
                      {wb.categories.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs cursor-pointer hover:bg-surface">
                          <input
                            type="radio"
                            name="budgetCategoryId"
                            checked={budgetCategoryId === c.id}
                            onChange={() => handlePickBudgetCategory(c)}
                          />
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: c.color || "var(--accent)" }}
                          />
                          <span className="text-text-primary">{c.name}</span>
                          <span className="text-accent ml-auto tabular-nums">
                            {formatCurrency(c.actual_amount)} / {formatCurrency(c.planned_amount)}
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                })}

                {standaloneWeekly.map((wb) => (
                  <div key={wb.id}>
                    <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-text-primary flex items-center gap-1.5">
                      {wb.name}
                      <span className="text-[9px] bg-success/15 text-success px-1.5 py-0.5 rounded-full">tgl transaksi masuk sini</span>
                    </div>
                    {wb.categories.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs cursor-pointer hover:bg-surface">
                        <input type="radio" name="budgetCategoryId" checked={budgetCategoryId === c.id} onChange={() => handlePickBudgetCategory(c)} />
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color || "var(--accent)" }} />
                        <span className="text-text-primary">{c.name}</span>
                        <span className="text-accent ml-auto tabular-nums">
                          {formatCurrency(c.actual_amount)} / {formatCurrency(c.planned_amount)}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}

                {directMonthlyCats.length > 0 && (
                  <div>
                    <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-text-secondary">
                      Langsung ke budget bulanan (gak dipecah mingguan)
                    </div>
                    {directMonthlyCats.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs cursor-pointer hover:bg-surface">
                        <input type="radio" name="budgetCategoryId" checked={budgetCategoryId === c.id} onChange={() => handlePickBudgetCategory(c)} />
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color || "var(--accent)" }} />
                        <span className="text-text-primary">{c.name}</span>
                        <span className="text-accent ml-auto tabular-nums">
                          {formatCurrency(c.actual_amount)} / {formatCurrency(c.planned_amount)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {budgetCategoryId && (
                <p className="text-[10px] text-success mt-1.5">
                  ✓ Dipotong langsung dari kategori ini, gak ambigu.
                </p>
              )}
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className={labelClass}>Metode Pembayaran</label>
            <select
              value={form.payment_method}
              onChange={(e) =>
                setForm({
                  ...form,
                  payment_method: e.target.value as PaymentMethod,
                })
              }
              className={inputClass}
            >
              {PAYMENT_METHODS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Account */}
          {type === "transfer" ? (
            <p className="text-xs text-text-secondary bg-surface rounded-md px-3 py-2.5">
              Buat transfer antar akun, pakai tombol &quot;Transfer&quot; di
              halaman Akun biar saldo dua akunnya ke-update otomatis.
            </p>
          ) : (
            <div>
              <label className={labelClass}>
                Akun <span className="text-accent">(opsional)</span>
              </label>
              <select
                value={form.account_id}
                onChange={(e) =>
                  setForm({ ...form, account_id: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Gak usah dihitung ke akun</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelClass}>Keterangan (opsional)</label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Catatan tambahan..."
              rows={2}
              className={cn(inputClass, "resize-none")}
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
              disabled={loading}
              className="flex-1 py-2.5 bg-text-primary text-background text-sm font-semibold rounded-md hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan Perubahan"
                  : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
