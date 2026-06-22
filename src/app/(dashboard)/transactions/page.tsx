"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect } from "react";
import { Plus, Search, ArrowUpRight, ArrowDownLeft, CreditCard, ArrowLeftRight, PiggyBank, Trash2, Pencil } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/utils";
import { StatusBadge } from "@/components/shared/Badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getTransactions, deleteTransaction } from "@/lib/db";
import { toast } from "sonner";
import type { Transaction, TransactionType } from "@/types";

const typeFilters: { label: string; value: TransactionType | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Pemasukan", value: "income" },
  { label: "Pengeluaran", value: "expense" },
  { label: "Bayar Utang", value: "debt_payment" },
  { label: "Tabungan", value: "saving" },
];

const typeIcon = {
  income: <ArrowDownLeft size={13} className="text-success" />,
  expense: <ArrowUpRight size={13} className="text-danger" />,
  debt_payment: <CreditCard size={13} className="text-warning" />,
  transfer: <ArrowLeftRight size={13} className="text-text-secondary" />,
  saving: <PiggyBank size={13} className="text-accent" />,
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setTransactions(await getTransactions()); }
    catch { toast.error("Gagal memuat transaksi"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const matchSearch = search === "" || tx.name.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || tx.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [transactions, search, typeFilter]);

  const totals = useMemo(() => ({
    income: filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: filtered.filter((t) => t.type !== "income").reduce((s, t) => s + t.amount, 0),
  }), [filtered]);

  async function handleDelete(id: string) {
    try { await deleteTransaction(id); toast.success("Transaksi dihapus"); load(); }
    catch { toast.error("Gagal menghapus"); }
  }

  function openAdd() {
    setEditData(null);
    setShowForm(true);
  }

  function openEdit(tx: Transaction) {
    setEditData(tx);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditData(null);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Transaksi</h1>
          <p className="text-sm text-text-secondary mt-0.5">{filtered.length} transaksi</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors">
          <Plus size={13} /> Tambah Transaksi
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Pemasukan</p>
          <p className="text-xl font-semibold text-success tabular-nums">+{formatCurrency(totals.income, true)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Pengeluaran</p>
          <p className="text-xl font-semibold text-danger tabular-nums">-{formatCurrency(totals.expense, true)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari transaksi..."
            className="w-full bg-surface border border-border rounded-md pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {typeFilters.map(({ label, value }) => (
            <button key={value} onClick={() => setTypeFilter(value)}
              className={cn("px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                typeFilter === value ? "bg-text-primary text-background" : "border border-border text-text-secondary hover:border-accent hover:text-text-primary"
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-base overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-text-secondary text-sm">Memuat...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="Belum ada transaksi" description="Tambah transaksi pertama kamu."
            action={
              <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold">
                <Plus size={13} /> Tambah Transaksi
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((tx) => {
              const isIncome = tx.type === "income";
              return (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface/30 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border">
                    {typeIcon[tx.type] ?? typeIcon.transfer}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(tx)}>
                    <p className="text-sm font-medium text-text-primary truncate">{tx.name}</p>
                    <p className="text-xs text-text-secondary">{tx.category?.name ?? "—"} · {formatDate(tx.date)}</p>
                  </div>
                  <StatusBadge status={tx.status} size="sm" />
                  <span className={cn("text-sm font-semibold tabular-nums", isIncome ? "text-success" : "text-text-primary")}>
                    {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => openEdit(tx)} className="p-1 text-accent hover:text-text-primary transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteId(tx.id)} className="p-1 text-accent hover:text-danger transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TransactionFormModal open={showForm} onClose={closeForm} editData={editData} />
      <ConfirmDialog open={!!deleteId} title="Hapus Transaksi?" description="Transaksi ini akan dihapus permanen dan tidak bisa dikembalikan."
        confirmLabel="Hapus" confirmVariant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}