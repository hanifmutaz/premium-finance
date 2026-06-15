"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Filter, Download, ArrowUpRight, ArrowDownLeft, CreditCard, ArrowLeftRight } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/utils";
import { StatusBadge, TypeBadge } from "@/components/shared/Badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { mockTransactions } from "@/lib/mock-data";
import type { Transaction, TransactionType } from "@/types";

const typeFilters: { label: string; value: TransactionType | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Pemasukan", value: "income" },
  { label: "Pengeluaran", value: "expense" },
  { label: "Bayar Utang", value: "debt_payment" },
  { label: "Transfer", value: "transfer" },
];

const typeIcon = {
  income: <ArrowDownLeft size={13} className="text-success" />,
  expense: <ArrowUpRight size={13} className="text-danger" />,
  debt_payment: <CreditCard size={13} className="text-warning" />,
  transfer: <ArrowLeftRight size={13} className="text-text-secondary" />,
};

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");

  const filtered = useMemo(() => {
    return mockTransactions.filter((tx) => {
      const matchSearch =
        search === "" ||
        tx.name.toLowerCase().includes(search.toLowerCase()) ||
        tx.category?.name.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || tx.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [search, typeFilter]);

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type !== "income").reduce((s, t) => s + t.amount, 0);
    return { income, expense };
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Transaksi</h1>
          <p className="text-sm text-text-secondary mt-0.5">{filtered.length} transaksi ditemukan</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors">
            <Download size={13} />
            Export
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors">
            <Plus size={13} />
            Tambah Transaksi
          </button>
        </div>
      </div>

      {/* Summary cards */}
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari transaksi..."
            className="w-full bg-surface border border-border rounded-md pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        {/* Type filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {typeFilters.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={cn(
                "px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                typeFilter === value
                  ? "bg-text-primary text-background"
                  : "border border-border text-text-secondary hover:border-accent hover:text-text-primary"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border">
          {["TRANSAKSI", "TANGGAL", "METODE", "STATUS", "NOMINAL"].map((h) => (
            <span key={h} className="text-[10px] font-semibold text-accent uppercase tracking-widest">
              {h}
            </span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Tidak ada transaksi"
            description="Coba ubah filter atau tambah transaksi baru."
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.type === "income";
  return (
    <div className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 items-center px-5 py-3.5 hover:bg-surface/30 transition-colors cursor-pointer group">
      {/* Name + type */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border group-hover:border-accent transition-colors">
          {typeIcon[tx.type]}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{tx.name}</p>
          <p className="text-xs text-text-secondary truncate">
            {tx.category?.name ?? "—"} · {tx.description ?? ""}
          </p>
        </div>
      </div>

      {/* Date */}
      <span className="text-xs text-text-secondary tabular-nums hidden md:block">
        {formatDate(tx.date, "dd MMM yyyy")}
      </span>

      {/* Method */}
      <span className="text-xs text-text-secondary capitalize hidden md:block">
        {tx.payment_method.replace("_", " ")}
      </span>

      {/* Status */}
      <div className="hidden md:flex">
        <StatusBadge status={tx.status} size="sm" />
      </div>

      {/* Amount */}
      <span className={cn(
        "text-sm font-semibold tabular-nums text-right",
        isIncome ? "text-success" : "text-text-primary"
      )}>
        {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
      </span>
    </div>
  );
}
