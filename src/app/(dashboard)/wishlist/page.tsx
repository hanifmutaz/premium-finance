"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Plus, ShoppingBag, CheckCircle2, Clock, Sparkles, Trash2 } from "lucide-react";
import { formatCurrency, cn } from "@/utils";
import { calcWishlistProgress } from "@/lib/calculations";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { PriorityBadge } from "@/components/shared/Badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getWishlist, deleteWishlistItem } from "@/lib/db";
import { toast } from "sonner";
import type { Wishlist } from "@/types";

const MONTHLY_SURPLUS = 3000000; // default estimate

export default function WishlistPage() {
  const [items, setItems] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setItems(await getWishlist()); }
    catch { toast.error("Gagal memuat wishlist"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const pending = items.filter((w) => w.status === "pending");
  const purchased = items.filter((w) => w.status === "purchased");

  async function handleDelete(id: string) {
    try { await deleteWishlistItem(id); toast.success("Item dihapus"); load(); }
    catch { toast.error("Gagal menghapus"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Wishlist</h1>
          <p className="text-sm text-text-secondary mt-0.5">{pending.length} item dalam daftar</p>
        </div>
      </div>

      <div className="card-base p-4 flex items-center gap-3 bg-surface/50">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-accent" />
        </div>
        <p className="text-sm text-text-secondary">
          Estimasi surplus bulanan:{" "}
          <span className="text-success font-semibold">{formatCurrency(MONTHLY_SURPLUS, true)}</span>
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-text-secondary text-sm">Memuat...</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Wishlist kosong" description="Tambah item yang ingin kamu beli." />
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Dalam Daftar ({pending.length})</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {pending.map((item) => <WishlistCard key={item.id} item={item} onDelete={() => setDeleteId(item.id)} />)}
              </div>
            </div>
          )}
          {purchased.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Sudah Dibeli ({purchased.length})</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {purchased.map((item) => <WishlistCard key={item.id} item={item} onDelete={() => setDeleteId(item.id)} />)}
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog open={!!deleteId} title="Hapus Item?" description="Item wishlist ini akan dihapus permanen."
        confirmLabel="Hapus" confirmVariant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}

function WishlistCard({ item, onDelete }: { item: Wishlist; onDelete: () => void }) {
  const { remaining, percentage, monthsNeeded, canBuy, recommendation } = calcWishlistProgress(item, MONTHLY_SURPLUS);
  const isPurchased = item.status === "purchased";

  return (
    <div className={cn("card-base p-5 hover:border-accent transition-colors group", isPurchased && "opacity-60")}>
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", isPurchased ? "bg-success/10" : "bg-surface")}>
            {isPurchased ? <CheckCircle2 size={16} className="text-success" /> : <ShoppingBag size={16} className="text-text-secondary" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{item.name}</p>
            <p className="text-xs text-text-secondary">{item.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={item.priority} />
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-accent hover:text-danger transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-accent uppercase mb-1">Harga</p>
          <p className="text-base font-semibold text-text-primary tabular-nums">{formatCurrency(Number(item.price), true)}</p>
        </div>
        <div>
          <p className="text-[10px] text-accent uppercase mb-1">Tabungan</p>
          <p className="text-base font-semibold text-success tabular-nums">{formatCurrency(Number(item.saved_amount), true)}</p>
        </div>
      </div>

      {!isPurchased && (
        <>
          <div className="mb-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Progress</span>
              <span className="text-xs font-semibold tabular-nums">{Math.round(percentage)}%</span>
            </div>
            <ProgressBar value={percentage} color={canBuy ? "success" : "default"} size="md" />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-surface rounded-md p-2.5">
              <p className="text-[10px] text-accent mb-1">Kurang</p>
              <p className="text-xs font-semibold text-danger tabular-nums">{formatCurrency(remaining, true)}</p>
            </div>
            <div className="bg-surface rounded-md p-2.5">
              <p className="text-[10px] text-accent mb-1">Estimasi</p>
              <p className="text-xs font-semibold text-text-primary">{monthsNeeded === Infinity ? "—" : `~${monthsNeeded} bln`}</p>
            </div>
          </div>
          <div className={cn("flex items-start gap-2 p-2.5 rounded-md text-xs", canBuy ? "bg-success/10 text-success" : "bg-surface text-text-secondary")}>
            {canBuy ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> : <Clock size={12} className="mt-0.5 shrink-0" />}
            <span className="leading-relaxed">{recommendation}</span>
          </div>
        </>
      )}

      {isPurchased && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-success/10 text-success text-xs">
          <CheckCircle2 size={12} /> Sudah dibeli!
        </div>
      )}
    </div>
  );
}
