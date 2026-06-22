"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Plus, ArrowLeftRight, Wallet, Landmark, Smartphone, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, cn } from "@/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import { TransferModal } from "@/components/accounts/TransferModal";
import { getAccounts, deleteAccount } from "@/lib/db";
import type { AccountWithBalance, AccountType } from "@/types";

const TYPE_ICON: Record<AccountType, typeof Wallet> = {
    cash: Wallet,
    bank: Landmark,
    ewallet: Smartphone,
    other: MoreHorizontal,
};
const TYPE_LABEL: Record<AccountType, string> = {
    cash: "Cash", bank: "Bank", ewallet: "E-Wallet", other: "Lainnya",
};

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const [editData, setEditData] = useState<AccountWithBalance | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        try { setAccounts(await getAccounts()); }
        catch { toast.error("Gagal memuat akun"); }
        finally { setLoading(false); }
    }

    useEffect(() => { load(); }, []);

    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

    async function handleDelete(id: string) {
        try { await deleteAccount(id); toast.success("Akun dihapus"); load(); }
        catch { toast.error("Gagal menghapus akun"); }
    }

    function openEdit(acc: AccountWithBalance) {
        setEditData(acc);
        setShowForm(true);
        setOpenMenuId(null);
    }

    if (loading) {
        return (
            <div className="space-y-5">
                <div className="card-base h-28 animate-pulse bg-surface" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <div key={i} className="card-base h-36 animate-pulse bg-surface" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Total saldo gabungan */}
            <div className="card-base p-5">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total Saldo Semua Akun</p>
                <p className={cn("text-3xl font-semibold tabular-nums", totalBalance >= 0 ? "text-text-primary" : "text-danger")}>
                    {formatCurrency(totalBalance)}
                </p>
                <p className="text-xs text-text-secondary mt-1">{accounts.length} sumber dana</p>
            </div>

            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">Sumber Dana</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowTransfer(true)} disabled={accounts.length < 2}
                        className="flex items-center gap-1.5 px-3 py-2 border border-border text-text-secondary text-xs font-medium rounded-md hover:border-accent hover:text-text-primary transition-colors disabled:opacity-40">
                        <ArrowLeftRight size={13} /> Transfer
                    </button>
                    <button onClick={() => { setEditData(null); setShowForm(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background text-xs font-semibold rounded-md hover:bg-text-primary/90 transition-colors">
                        <Plus size={13} /> Tambah Akun
                    </button>
                </div>
            </div>

            {accounts.length === 0 ? (
                <EmptyState
                    icon={Wallet}
                    title="Belum ada sumber dana"
                    description="Tambahin akun kayak BCA, GoPay, DANA, atau Cash buat mulai breakdown saldo kamu"
                    action={
                        <button onClick={() => setShowForm(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-text-primary text-background text-sm font-semibold rounded-md hover:bg-text-primary/90 transition-colors">
                            <Plus size={14} /> Tambah Akun
                        </button>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts.map((acc) => {
                        const Icon = TYPE_ICON[acc.type];
                        return (
                            <div key={acc.id} className="card-base p-5 relative group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: `${acc.color || "#64748B"}20` }}>
                                            <Icon size={16} style={{ color: acc.color || "#64748B" }} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary leading-tight">{acc.name}</p>
                                            <p className="text-xs text-text-secondary mt-0.5">{TYPE_LABEL[acc.type]}</p>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <button onClick={() => setOpenMenuId(openMenuId === acc.id ? null : acc.id)}
                                            className="text-text-secondary opacity-0 group-hover:opacity-100 hover:text-text-primary transition-opacity p-1">
                                            <MoreHorizontal size={15} />
                                        </button>
                                        {openMenuId === acc.id && (
                                            <div className="absolute right-0 top-7 bg-surface-card border border-border rounded-md shadow-lg z-10 overflow-hidden w-32">
                                                <button onClick={() => openEdit(acc)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface transition-colors">
                                                    <Pencil size={12} /> Edit
                                                </button>
                                                <button onClick={() => { setDeleteId(acc.id); setOpenMenuId(null); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-surface transition-colors">
                                                    <Trash2 size={12} /> Hapus
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className={cn("text-xl font-semibold tabular-nums", acc.balance >= 0 ? "text-text-primary" : "text-danger")}>
                                    {formatCurrency(acc.balance)}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}

            <AccountFormModal open={showForm} onClose={() => { setShowForm(false); setEditData(null); load(); }} editData={editData} />
            <TransferModal open={showTransfer} onClose={() => { setShowTransfer(false); load(); }} accounts={accounts} />
            <ConfirmDialog
                open={!!deleteId}
                title="Hapus akun ini?"
                description="Transaksi yang masih nempel ke akun ini gak ikut terhapus, cuma jadi tanpa akun."
                confirmLabel="Hapus"
                confirmVariant="danger"
                onConfirm={() => deleteId && handleDelete(deleteId)}
                onClose={() => setDeleteId(null)}
            />
        </div>
    );
}