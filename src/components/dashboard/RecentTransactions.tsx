"use client";

import Link from "next/link";
import {
  ShoppingBag, Utensils, Home, Activity, ArrowDownLeft, ArrowUpRight,
  CreditCard, ChevronDown,
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/utils";
import { StatusBadge } from "@/components/shared/Badges";
import type { Transaction } from "@/types";

const categoryIcons: Record<string, React.ReactNode> = {
  Belanja: <ShoppingBag size={14} />,
  Makan: <Utensils size={14} />,
  Tagihan: <Home size={14} />,
  Kesehatan: <Activity size={14} />,
  "Pembayaran Utang": <CreditCard size={14} />,
};

function TxIcon({ tx }: { tx: Transaction }) {
  const icon = tx.category ? categoryIcons[tx.category.name] : null;
  const isIncome = tx.type === "income";

  return (
    <div className={cn(
      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
      isIncome ? "bg-success/10 text-success" : "bg-surface text-text-secondary"
    )}>
      {icon ?? (isIncome ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />)}
    </div>
  );
}

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="card-base">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Transaksi Terbaru</h3>
        </div>
        <Link
          href="/transactions"
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          Lihat Semua
        </Link>
      </div>

      {/* Table header — desktop */}
      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 border-b border-border">
        {["MERCHANT / KATEGORI", "TANGGAL", "STATUS", "NOMINAL"].map((h) => (
          <span key={h} className="text-[10px] font-semibold text-accent tracking-widest uppercase">
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {transactions.slice(0, 6).map((tx) => {
          const isIncome = tx.type === "income";
          return (
            <div
              key={tx.id}
              className="flex md:grid md:grid-cols-[1fr_auto_auto_auto] gap-3 md:gap-4 items-center px-5 py-3.5 hover:bg-surface/30 transition-colors cursor-pointer"
            >
              {/* Name + category */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <TxIcon tx={tx} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{tx.name}</p>
                  <p className="text-xs text-text-secondary truncate">
                    {tx.category?.name ?? tx.type}
                  </p>
                </div>
              </div>

              {/* Date */}
              <span className="text-xs text-text-secondary tabular-nums hidden md:block shrink-0">
                {formatDate(tx.date, "dd MMM yyyy")}
              </span>

              {/* Status */}
              <div className="hidden md:flex shrink-0">
                <StatusBadge status={tx.status} size="sm" />
              </div>

              {/* Amount */}
              <span className={cn(
                "text-sm font-semibold tabular-nums shrink-0 ml-auto md:ml-0",
                isIncome ? "text-success" : "text-text-primary"
              )}>
                {isIncome ? "+" : "-"}{formatCurrency(tx.amount, true)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      <div className="flex justify-center px-5 py-3 border-t border-border">
        <button className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors">
          Tampilkan Lebih Banyak <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}
