"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect } from "react";
import { Plus, Search, ArrowUpRight, ArrowDownLeft, CreditCard, ArrowLeftRight, PiggyBank, Trash2, Pencil, Wallet } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/utils";
import { StatusBadge } from "@/components/shared/Badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getTransactions, deleteTransaction, getAccounts } from "@/lib/db";
import { toast } from "sonner";
import type { Transaction, TransactionType, AccountWithBalance } from "@/types";

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

// "Hari Ini" / "Kemarin" / nama hari lengkap kalau masih minggu ini / tanggal lengkap kalau udah lebih lama.
// Ini yang bikin list transaksi gak keliatan numpuk acak — ada anchor visual per hari.
function groupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(today) - startOfDay(d)) / 86400000);

  if (diffDays === 0) return "Hari Ini";
  if (diffDays === 1) return "Kemarin";
  if (diffDays > 1 && diffDays < 7) return formatDate(d, "EEEE, dd MMM");
  return formatDate(d, "EEEE, dd MMM yyyy");
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [txs, accs] = await Promise.all([getTransactions(), getAccounts()]);
      setTransactions(txs);
      setAccounts(accs);
    } catch { toast.error("Gagal memuat transaksi"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const matchSearch = search === "" ||
        tx.name.toLowerCase().includes(search.toLowerCase()) ||
        (tx.category?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (tx.account?.name ?? "").toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || tx.type === typeFilter;
      const matchAccount = accountFilter === "all" || tx.account_id === accountFilter;
      return matchSearch && matchType && matchAccount;
    });
  }, [transactions, search, typeFilter, accountFilter]);

  const totals = useMemo(() => ({
    income: filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: filtered.filter((t) => t.type !== "income" && t.type !== "transfer").reduce((s, t) => s + t.amount, 0),
  }), [filtered]);

  // Transaksi (yang sudah urut date desc + created_at desc dari getTransactions)
  // dikelompokin per hari biar gampang dipindai matanya, bukan satu list panjang
  // tanpa pemisah. Urutan grup ngikutin urutan kemunculan transaksi pertamanya,
  // jadi tetep konsisten sama sort dari query.
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filtered.forEach((tx) => {
      const label = groupLabel(tx.date);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(tx);
    });
    return Array.from(map.entries());
  }, [filtered]);

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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kategori, atau akun..."
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

      {accounts.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Wallet size={13} className="text-accent shrink-0" />
          <button onClick={() => setAccountFilter("all")}
            className={cn("px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
              accountFilter === "all" ? "bg-surface-card text-text-primary border border-accent" : "text-text-secondary hover:text-text-primary"
            )}>
            Semua Akun
          </button>
          {accounts.map((acc) => (
            <button key={acc.id} onClick={() => setAccountFilter(acc.id)}
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                accountFilter === acc.id ? "bg-surface-card text-text-primary border border-accent" : "text-text-secondary hover:text-text-primary"
              )}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: acc.color || "#64748B" }} />
              {acc.name}
            </button>
          ))}
        </div>
      )}

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
          groups.map(([label, txs]) => {
            const dayTotal = txs.reduce((s, t) => s + (t.type === "income" ? t.amount : t.type === "transfer" ? 0 : -t.amount), 0);
            return (
              <div key={label}>
                <div className="flex items-center justify-between px-5 py-2 bg-surface/50 border-y border-border sticky top-0">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{label}</span>
                  <span className={cn("text-xs font-medium tabular-nums", dayTotal >= 0 ? "text-success" : "text-danger")}>
                    {dayTotal >= 0 ? "+" : ""}{formatCurrency(dayTotal, true)}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {txs.map((tx) => {
                    const isIncome = tx.type === "income";
                    return (
                      <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface/30 transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border">
                          {typeIcon[tx.type] ?? typeIcon.transfer}
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(tx)}>
                          <p className="text-sm font-medium text-text-primary truncate">{tx.name}</p>
                          <p className="text-xs text-text-secondary truncate">
                            {tx.category?.name ?? "—"}
                            {tx.account?.name && <> · {tx.account.name}</>}
                            {tx.type === "transfer" && tx.to_account?.name && <> → {tx.to_account.name}</>}
                          </p>
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
              </div>
            );
          })
        )}
      </div>

      <TransactionFormModal open={showForm} onClose={closeForm} editData={editData} />
      <ConfirmDialog open={!!deleteId} title="Hapus Transaksi?" description="Transaksi ini akan dihapus permanen dan tidak bisa dikembalikan."
        confirmLabel="Hapus" confirmVariant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}