"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils";
import { addAccount, updateAccount } from "@/lib/db";
import type { Account, AccountType } from "@/types";

interface Props { open: boolean; onClose: () => void; editData?: Account | null; }

const TYPE_OPTIONS: { v: AccountType; l: string }[] = [
    { v: "cash", l: "Cash" },
    { v: "bank", l: "Bank" },
    { v: "ewallet", l: "E-Wallet" },
    { v: "other", l: "Lainnya" },
];

const COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#EC4899", "#14B8A6", "#64748B"];

function emptyForm() {
    return { name: "", type: "ewallet" as AccountType, initial_balance: "", color: COLORS[0] };
}

export function AccountFormModal({ open, onClose, editData }: Props) {
    const isEdit = !!editData;
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState(emptyForm());

    useEffect(() => {
        if (!open) return;
        if (editData) {
            setForm({
                name: editData.name,
                type: editData.type,
                initial_balance: String(editData.initial_balance),
                color: editData.color || COLORS[0],
            });
        } else {
            setForm(emptyForm());
        }
    }, [open, editData]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name) {
            toast.error("Nama akun wajib diisi");
            return;
        }
        setLoading(true);
        try {
            const payload = {
                name: form.name,
                type: form.type,
                initial_balance: parseFloat(form.initial_balance) || 0,
                color: form.color,
            };

            if (isEdit && editData) {
                await updateAccount(editData.id, payload);
                toast.success("Akun berhasil diperbarui");
            } else {
                await addAccount(payload);
                toast.success("Akun berhasil ditambahkan");
            }
            setForm(emptyForm());
            onClose();
        } catch { toast.error(isEdit ? "Gagal memperbarui akun" : "Gagal menambah akun"); }
        finally { setLoading(false); }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-md bg-surface-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface-card">
                    <h2 className="text-sm font-semibold text-text-primary">{isEdit ? "Edit Akun" : "Tambah Akun"}</h2>
                    <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors"><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Nama Akun *</label>
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="mis. BCA, GoPay, DANA, Cash..."
                            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Jenis</label>
                        <div className="grid grid-cols-4 gap-1.5 p-1 bg-surface rounded-lg">
                            {TYPE_OPTIONS.map(({ v, l }) => (
                                <button key={v} type="button" onClick={() => setForm({ ...form, type: v })}
                                    className={cn("py-1.5 rounded-md text-xs font-medium transition-colors",
                                        form.type === v ? "bg-text-primary text-background" : "text-text-secondary hover:text-text-primary"
                                    )}>{l}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">
                            Saldo Awal {isEdit ? "" : "(saldo saat ini, sebelum dicatat di app)"}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
                            <input type="number" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
                                placeholder="0"
                                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Warna</label>
                        <div className="flex gap-2 flex-wrap">
                            {COLORS.map((c) => (
                                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                                    className={cn("w-7 h-7 rounded-full transition-transform", form.color === c && "ring-2 ring-offset-2 ring-offset-surface-card ring-text-primary scale-110")}
                                    style={{ backgroundColor: c }} />
                            ))}
                        </div>
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