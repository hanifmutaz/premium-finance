"use client";

import { PiggyBank } from "lucide-react";
import { formatCurrency, calculateProgress } from "@/utils";
import { ProgressBar } from "@/components/shared/ProgressBar";
import type { SavingsOverview } from "@/lib/db";

export function SavingsOverviewWidget({ data }: { data: SavingsOverview }) {
  const pct = data.totalTarget > 0 ? calculateProgress(data.totalSaved, data.totalTarget) : 0;

  return (
    <div className="card-base p-5 flex flex-col h-full">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <PiggyBank size={15} className="text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Tabungan</h3>
          <p className="text-xs text-text-secondary">Target & Wishlist aktif</p>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-2xl font-semibold text-success tabular-nums">{formatCurrency(data.totalSaved, true)}</p>
        <p className="text-xs text-text-secondary mt-0.5">dari target {formatCurrency(data.totalTarget, true)}</p>
      </div>

      <ProgressBar value={pct} color={pct >= 80 ? "success" : pct >= 50 ? "default" : "warning"} size="md" />
      <p className="text-xs text-accent mt-1.5 mb-4">{Math.round(pct)}% tercapai</p>

      {data.items.length === 0 ? (
        <p className="text-xs text-text-secondary py-4 text-center flex-1">Belum ada target/wishlist aktif</p>
      ) : (
        <div className="flex-1 space-y-2.5">
          {data.items.slice(0, 4).map((item) => {
            const itemPct = item.target > 0 ? calculateProgress(item.saved, item.target) : 0;
            return (
              <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-primary truncate">{item.name}</span>
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
