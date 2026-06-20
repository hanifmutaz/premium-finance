"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils";
import { addRecurringTransaction, updateRecurringTransaction, getCategories } from "@/lib/db";
import type { RecurringTransaction, PaymentMethod } from "@/types";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: "transfer", label: "Transfer Bank" },
    { value: "cash", label: "Tunai" },
    { value: "credit_card", label: "Kartu Kredit" },
    { value: "debit_card", label: "Kartu Debit" },
    { value: "e-wallet", label: "E-Wallet" },
    { value: "other", label: "Lainnya" },
];

const WEEKDAYS = [
    { value: 0, label: "Minggu" }, { value: 1, label: "Senin" }, { value: 2, label: "Selasa" },
    { value: 3, label: "Rabu" }, { value: 4, label: "Kamis" }, { value: 5, label: "Jumat" }, { value: 6, label: "Sabtu" },
];

interface Props { open: boolean; onClose: () => void; editData?: RecurringTransaction | null; }

function emptyForm() {
    return {
        name: "", type: "expense" as "income" | "expense", amount: "",
        category_id: "", payment_method: "transfer" as PaymentMethod,
        frequency: "monthly" as "monthly" | "weekly",
        day_of_period: 1,
        start_date: new Date().toISOString().split("T")[0],
        end_date: "", notes: "",
    };
}

export function RecurringFormModal({ open, onClose, editData }: Props) {
    const isEdit = !!editData;
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [form, setForm] = useState(emptyForm());

    useEffect(() => {
        if (!open) return;
        if (editData) {
            setForm({
                name: editData.name,
                type: editData.type,
                amount: String(editData.amount),
                category_id: editData.category_id ?? "",
                payment_method: editData.payment_method,
                frequency: editData.frequency,
                day_of_period: editData.day_of_period,
                start_date: editData.start_date,
                end_date: editData.end_date ?? "",
                notes: editData.notes ?? "",
            });
        } else {
            setForm(emptyForm());
        }
    }, [open, editData]);

    useEffect(() => {
        if (open) {
            getCategories(form.type).then(setCategories).catch(() => { });
        }
    }, [open, form.type]);

    function handleFrequencyChange(freq: "monthly" | "weekly") {
        setForm({ ...form, frequency: freq, day_of_period: freq === "monthly" ? 1 : 1 });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name || !form.amount) {
            toast.error("Nama dan nominal wajib diisi");
            return;
        }
        setLoading(true);
        try {
            const payload = {
                name: form.name,
                type: form.type,
                amount: parseFloat(form.amount),
                category_id: form.category_id || undefined,
                payment_method: form.payment_method,
                frequency: form.frequency,
                day_of_period: form.day_of_period,
                start_date: form.start_date,
                end_date: form.end_date || undefined,
                notes: form.notes || undefined,
            };

            if (isEdit && editData) {
                await updateRecurringTransaction(editData.id, payload);
                toast.success("Template berulang berhasil diperbarui");
            } else {
                await addRecurringTransaction(payload);
                toast.success("Template berulang berhasil dibuat");
            }
            setForm(emptyForm());
            onClose();
        } catch {
            toast.error(isEdit ? "Gagal memperbarui template" : "Gagal menyimpan template");
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-md bg-surface-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface-card">
                    <h2 className="text-sm font-semibold text-text-primary">{isEdit ? "Edit Template Berulang" : "Buat Template Berulang"}</h2>
                    <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors"><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface rounded-lg">
                        {(["income", "expense"] as const).map((t) => (
                            <button key={t} type="button" onClick={() => setForm({ ...form, type: t, category_id: "" })}
                                className={cn("py-1.5 rounded-md text-xs font-medium transition-colors",
                                    form.type === t ? "bg-text-primary text-background" : "text-text-secondary hover:text-text-primary"
                                )}>
                                {t === "income" ? "Pemasukan" : "Pengeluaran"}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Nama Template *</label>
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="mis. Gaji Bulanan, Sewa Kost..."
                            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Nominal *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
                            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                placeholder="0"
                                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Kategori</label>
                        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors">
                            <option value="">Pilih kategori</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Frekuensi</label>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface rounded-lg">
                            {(["monthly", "weekly"] as const).map((f) => (
                                <button key={f} type="button" onClick={() => handleFrequencyChange(f)}
                                    className={cn("py-1.5 rounded-md text-xs font-medium transition-colors",
                                        form.frequency === f ? "bg-text-primary text-background" : "text-text-secondary hover:text-text-primary"
                                    )}>
                                    {f === "monthly" ? "Bulanan" : "Mingguan"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {form.frequency === "monthly" ? (
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">Tanggal setiap bulan</label>
                            <input type="number" min={1} max={31} value={form.day_of_period}
                                onChange={(e) => setForm({ ...form, day_of_period: Math.min(31, Math.max(1, Number(e.target.value))) })}
                                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors tabular-nums" />
                            <p className="text-[10px] text-accent mt-1">
                                Untuk bulan yang lebih pendek (mis. Februari), otomatis disesuaikan ke tanggal terakhir bulan itu.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">Hari dalam seminggu</label>
                            <select value={form.day_of_period} onChange={(e) => setForm({ ...form, day_of_period: Number(e.target.value) })}
                                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors">
                                {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">Mulai Berlaku</label>
                            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">Berhenti (opsional)</label>
                            <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Catatan (opsional)</label>
                        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Catatan tambahan..." rows={2}
                            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors resize-none" />
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-md hover:border-accent hover:text-text-primary transition-colors">
                            Batal
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 py-2.5 bg-text-primary text-background text-sm font-semibold rounded-md hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}