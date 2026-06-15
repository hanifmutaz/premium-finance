"use client";

import { Plus, ShoppingBag, CheckCircle2, Clock, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/utils";
import { calcWishlistProgress } from "@/lib/calculations";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { PriorityBadge } from "@/components/shared/Badges";
import { mockWishlist } from "@/lib/mock-data";
import { mockDashboardStats } from "@/lib/mock-data";
import type { Wishlist } from "@/types";

const MONTHLY_SURPLUS = mockDashboardStats.monthly_remaining;

export default function WishlistPage() {
  const pending = mockWishlist.filter((w) => w.status === "pending");
  const purchased = mockWishlist.filter((w) => w.status === "purchased");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Wishlist</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {pending.length} item dalam daftar keinginan
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors">
          <Plus size={13} />
          Tambah Item
        </button>
      </div>

      {/* Info banner */}
      <div className="card-base p-4 flex items-center gap-3 bg-surface/50">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-accent" />
        </div>
        <div>
          <p className="text-sm text-text-primary font-medium">Saldo Surplus Tersedia</p>
          <p className="text-xs text-text-secondary">
            Kamu punya{" "}
            <span className="text-success font-semibold">{formatCurrency(MONTHLY_SURPLUS, true)}</span>
            {" "}surplus/bulan untuk dialokasikan ke wishlist
          </p>
        </div>
      </div>

      {/* Pending items */}
      <div>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Dalam Daftar ({pending.length})
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {pending.map((item) => (
            <WishlistCard key={item.id} item={item} monthlySurplus={MONTHLY_SURPLUS} />
          ))}
        </div>
      </div>

      {/* Purchased */}
      {purchased.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Sudah Dibeli ({purchased.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {purchased.map((item) => (
              <WishlistCard key={item.id} item={item} monthlySurplus={MONTHLY_SURPLUS} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WishlistCard({ item, monthlySurplus }: { item: Wishlist; monthlySurplus: number }) {
  const { remaining, percentage, monthsNeeded, estimatedDate, canBuy, recommendation } =
    calcWishlistProgress(item, monthlySurplus);

  const isPurchased = item.status === "purchased";

  return (
    <div className={cn(
      "card-base p-5 hover:border-accent transition-colors",
      isPurchased && "opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            isPurchased ? "bg-success/10" : "bg-surface"
          )}>
            {isPurchased
              ? <CheckCircle2 size={16} className="text-success" />
              : <ShoppingBag size={16} className="text-text-secondary" />
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{item.name}</p>
            <p className="text-xs text-text-secondary">{item.category}</p>
          </div>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>

      {/* Price */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-accent uppercase mb-1">Harga</p>
          <p className="text-base font-semibold text-text-primary tabular-nums">
            {formatCurrency(item.price, true)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-accent uppercase mb-1">Tabungan</p>
          <p className="text-base font-semibold text-success tabular-nums">
            {formatCurrency(item.saved_amount, true)}
          </p>
        </div>
      </div>

      {/* Progress */}
      {!isPurchased && (
        <>
          <div className="mb-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Progress Tabungan</span>
              <span className="text-xs font-semibold tabular-nums">{Math.round(percentage)}%</span>
            </div>
            <ProgressBar value={percentage} color={canBuy ? "success" : "default"} size="md" />
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-surface rounded-md p-2.5">
              <p className="text-[10px] text-accent mb-1">Kurang</p>
              <p className="text-xs font-semibold text-danger tabular-nums">
                {formatCurrency(remaining, true)}
              </p>
            </div>
            <div className="bg-surface rounded-md p-2.5">
              <p className="text-[10px] text-accent mb-1">Estimasi</p>
              <p className="text-xs font-semibold text-text-primary">
                {monthsNeeded === Infinity ? "Tidak tentu" : `~${monthsNeeded} bln`}
              </p>
            </div>
          </div>

          {/* Recommendation */}
          <div className={cn(
            "flex items-start gap-2 p-2.5 rounded-md text-xs",
            canBuy ? "bg-success/10 text-success" : "bg-surface text-text-secondary"
          )}>
            {canBuy ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> : <Clock size={12} className="mt-0.5 shrink-0" />}
            <span className="leading-relaxed">{recommendation}</span>
          </div>
        </>
      )}

      {isPurchased && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-success/10 text-success text-xs">
          <CheckCircle2 size={12} />
          Sudah dibeli!
        </div>
      )}

      {!isPurchased && (
        <button className="mt-3 w-full py-2 border border-border text-text-secondary text-xs font-medium rounded-md hover:border-text-primary hover:text-text-primary transition-colors">
          Update Tabungan
        </button>
      )}
    </div>
  );
}
