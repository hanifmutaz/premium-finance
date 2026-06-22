"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/utils";
import { transferBetweenAccounts } from "@/lib/db";
import type { AccountWithBalance } from "@/types";

interface Props { open: boolean; onClose: () => void; accounts: AccountWithBalance[]; }

export function TransferModal({ open, onClose, accounts }: Props) {
    const [loading, setLoading] = useState(false);
    const [fromId, setFromId] = useState("");
    const [toId, setToId] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState("");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (!open) return;
        setFromId(accounts[0]?.id ?? "");
        setToId(accounts[1]?.id ?? "");
        setAmount("");
        setNotes("");
        setDate(new Date().toISOString().split("T")[0]);
    }, [open, accounts]);

    const fromAccount = accounts.find((a) => a.id === fromId);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const val = parseFloat(amount);
        if (!fromId || !toId) { toast.error("Pilih akun asal dan tujuan"); return; }
        if (fromId === toId) { toast.error("Akun asal dan tujuan gak boleh sama"); return; }
        if (!val || val <= 0) { toast.error("Jumlah transfer gak valid"); return; }

        setLoading(true);
        try {
            await transferBetweenAccounts({ from_account_id: fromId, to_account_id: toId, amount: val, date, notes });
            toast.success("Transfer berhasil dicatat");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Gagal mencatat transfer");
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
                    <h2 className="text-sm font-semibold text-text-primary">Transfer Antar Akun</h2>
                    <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors"><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Dari Akun *</label>
                        <select value={fromId} onChange={(e) => setFromId(e.target.value)}
                            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors">
                            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance, true)}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-center"><ArrowDown size={16} className="text-accent" /></div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Ke Akun *</label>
                        <select value={toId} onChange={(e) => setToId(e.target.value)}
                            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors">
                            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance, true)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Jumlah *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                                placeholder="0"
                                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums" />
                        </div>
                        {fromAccount && Number(amount) > fromAccount.balance && (
                            <p className="text-xs text-warning mt-1">Saldo {fromAccount.name} cuma {formatCurrency(fromAccount.balance, true)}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Tanggal *</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Catatan (opsional)</label>
                        <input value={notes} onChange={(e) => setNotes(e.target.value)}
                            placeholder="mis. Top up GoPay"
                            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-md hover:border-accent hover:text-text-primary transition-colors">
                            Batal
                        </button>
                        <button type="submit" disabled={loading || accounts.length < 2}
                            className="flex-1 py-2.5 bg-text-primary text-background text-sm font-semibold rounded-md hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            {loading ? "Memproses..." : "Transfer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}