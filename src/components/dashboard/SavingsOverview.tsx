"use client";

import { PiggyBank, Target } from "lucide-react";
import { formatCurrency, calculateProgress } from "@/utils";
import { ProgressBar } from "@/components/shared/ProgressBar";
import type { SavingsOverview } from "@/lib/db";

export function SavingsOverviewWidget({
  data, cumulative,
}: { data: SavingsOverview; cumulative: number }) {
  const pct = data.totalTarget > 0 ? calculateProgress(data.totalSaved, data.totalTarget) : 0;

  return (
    <div className="card-base p-5 flex flex-col h-full">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <PiggyBank size={15} className="text-accent" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary">Tabungan</h3>
      </div>

      {/* Angka utama: total dari transaksi bertipe "saving" — uang yang sengaja
          dipindahin ke tabungan, BUKAN sisa/leftover income-expense. */}
      <div className="mb-4">
        <p className="text-[10px] text-accent uppercase tracking-wider mb-1">Total Tabungan</p>
        <p className={cumulative >= 0 ? "text-2xl font-semibold text-success tabular-nums" : "text-2xl font-semibold text-danger tabular-nums"}>
          {formatCurrency(cumulative, true)}
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          Total transaksi &quot;Nabung&quot; sejak pertama kali
        </p>
      </div>

      <div className="border-t border-border my-1" />

      {/* Subset: berapa dari "Total Tabungan" di atas yang udah sengaja
          dialokasikan ke target Goals/Wishlist spesifik. */}
      <div className="mt-3 mb-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Target size={11} className="text-text-secondary" />
          <p className="text-[10px] text-text-secondary uppercase tracking-wider">Dialokasikan ke Target</p>
        </div>
        <p className="text-base font-semibold text-text-primary tabular-nums">
          {formatCurrency(data.totalSaved, true)}
          <span className="text-xs text-text-secondary font-normal"> / {formatCurrency(data.totalTarget, true)}</span>
        </p>
        <ProgressBar value={pct} color={pct >= 80 ? "success" : pct >= 50 ? "default" : "warning"} size="sm" />
        <p className="text-xs text-accent mt-1">{Math.round(pct)}% dari target Goals & Wishlist</p>
      </div>

      {data.items.length === 0 ? (
        <p className="text-xs text-text-secondary py-2 text-center flex-1">Belum ada target/wishlist aktif</p>
      ) : (
        <div className="flex-1 space-y-2">
          {data.items.slice(0, 3).map((item) => {
            const itemPct = item.target > 0 ? calculateProgress(item.saved, item.target) : 0;
            return (
              <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-secondary truncate">{item.name}</span>
                <span className="text-xs font-semibold text-text-secondary tabular-nums shrink-0">
                  {Math.round(itemPct)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
