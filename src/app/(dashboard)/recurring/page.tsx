"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Plus, Repeat, ArrowDownLeft, ArrowUpRight, Trash2, Pencil, Pause, Play, Calendar } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RecurringFormModal } from "@/components/recurring/RecurringFormModal";
import { getRecurringTransactions, deleteRecurringTransaction, toggleRecurringActive } from "@/lib/db";
import { toast } from "sonner";
import type { RecurringTransaction } from "@/types";

const WEEKDAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function describeSchedule(rec: RecurringTransaction) {
    if (rec.frequency === "monthly") {
        return `Setiap tanggal ${rec.day_of_period}`;
    }
    return `Setiap hari ${WEEKDAY_NAMES[rec.day_of_period]}`;
}

export default function RecurringPage() {
    const [items, setItems] = useState<RecurringTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editData, setEditData] = useState<RecurringTransaction | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        try { setItems(await getRecurringTransactions() as RecurringTransaction[]); }
        catch { toast.error("Gagal memuat template berulang"); }
        finally { setLoading(false); }
    }

    useEffect(() => { load(); }, []);

    const active = items.filter((i) => i.is_active);
    const paused = items.filter((i) => !i.is_active);
    const monthlyIncomeTotal = active.filter((i) => i.type === "income" && i.frequency === "monthly").reduce((s, i) => s + Number(i.amount), 0);
    const monthlyExpenseTotal = active.filter((i) => i.type === "expense" && i.frequency === "monthly").reduce((s, i) => s + Number(i.amount), 0);

    function openAdd() { setEditData(null); setShowForm(true); }
    function openEdit(item: RecurringTransaction) { setEditData(item); setShowForm(true); }
    function closeForm() { setShowForm(false); setEditData(null); load(); }

    async function handleToggle(item: RecurringTransaction) {
        try {
            await toggleRecurringActive(item.id, !item.is_active);
            toast.success(item.is_active ? "Template dijeda" : "Template diaktifkan kembali");
            load();
        } catch { toast.error("Gagal mengubah status template"); }
    }

    async function handleDelete(id: string) {
        try { await deleteRecurringTransaction(id); toast.success("Template dihapus"); load(); }
        catch { toast.error("Gagal menghapus template"); }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-text-primary">Transaksi Berulang</h1>
                    <p className="text-sm text-text-secondary mt-0.5">Otomatis catat pemasukan/pengeluaran rutin</p>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors">
                    <Plus size={13} /> Buat Template
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="stat-card">
                    <p className="text-xs text-text-secondary uppercase tracking-wider">Pemasukan Bulanan (aktif)</p>
                    <p className="text-xl font-semibold text-success tabular-nums">{formatCurrency(monthlyIncomeTotal, true)}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-text-secondary uppercase tracking-wider">Pengeluaran Bulanan (aktif)</p>
                    <p className="text-xl font-semibold text-danger tabular-nums">{formatCurrency(monthlyExpenseTotal, true)}</p>
                </div>
            </div>

            {loading ? (
                <div className="py-12 text-center text-text-secondary text-sm">Memuat...</div>
            ) : items.length === 0 ? (
                <EmptyState icon={Repeat} title="Belum ada template berulang"
                    description="Buat template untuk pemasukan/pengeluaran yang rutin terjadi, seperti gaji atau sewa."
                    action={
                        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold">
                            <Plus size={13} /> Buat Template
                        </button>
                    }
                />
            ) : (
                <div className="space-y-5">
                    {active.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Aktif ({active.length})</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {active.map((item) => (
                                    <RecurringCard key={item.id} item={item}
                                        onEdit={() => openEdit(item)} onToggle={() => handleToggle(item)} onDelete={() => setDeleteId(item.id)} />
                                ))}
                            </div>
                        </div>
                    )}
                    {paused.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Dijeda ({paused.length})</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {paused.map((item) => (
                                    <RecurringCard key={item.id} item={item}
                                        onEdit={() => openEdit(item)} onToggle={() => handleToggle(item)} onDelete={() => setDeleteId(item.id)} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <RecurringFormModal open={showForm} onClose={closeForm} editData={editData} />
            <ConfirmDialog open={!!deleteId} title="Hapus Template?"
                description="Template ini akan dihapus permanen. Transaksi yang sudah pernah ter-generate sebelumnya tidak akan terhapus."
                confirmLabel="Hapus" confirmVariant="danger"
                onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
        </div>
    );
}

function RecurringCard({
    item, onEdit, onToggle, onDelete,
}: { item: RecurringTransaction; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
    const isIncome = item.type === "income";
    return (
        <div className={cn("card-base p-5 hover:border-accent transition-colors group", !item.is_active && "opacity-60")}>
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shrink-0">
                        {isIncome ? <ArrowDownLeft size={16} className="text-success" /> : <ArrowUpRight size={16} className="text-danger" />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                        <p className="text-xs text-text-secondary mt-0.5">{item.category?.name ?? "—"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={onToggle} className="p-1.5 text-accent hover:text-text-primary transition-colors" title={item.is_active ? "Jeda" : "Aktifkan"}>
                        {item.is_active ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button onClick={onEdit} className="p-1.5 text-accent hover:text-text-primary transition-colors">
                        <Pencil size={14} />
                    </button>
                    <button onClick={onDelete} className="p-1.5 text-accent hover:text-danger transition-colors">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <p className={cn("text-xl font-bold tabular-nums mb-3", isIncome ? "text-success" : "text-text-primary")}>
                {isIncome ? "+" : "-"}{formatCurrency(Number(item.amount))}
            </p>

            <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-surface px-2.5 py-2 rounded-md">
                <Calendar size={12} />
                {describeSchedule(item)}
                <span className="text-accent">·</span>
                {item.frequency === "monthly" ? "Bulanan" : "Mingguan"}
            </div>

            {item.last_generated_date && (
                <p className="text-[10px] text-accent mt-2">
                    Terakhir di-generate: {formatDate(item.last_generated_date)}
                </p>
            )}
        </div>
    );
}