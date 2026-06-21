"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Wallet, Target, ShoppingBag, HandCoins, Loader2 } from "lucide-react";
import { cn } from "@/utils";
import type { SearchResult } from "@/lib/db";

const iconMap = {
  debt: Wallet,
  transaction: Receipt,
  goal: Target,
  wishlist: ShoppingBag,
  receivable: HandCoins,
};

interface Props {
  results: SearchResult[];
  loading: boolean;
  query: string;
  onClose: () => void;
}

export function SearchDropdown({ results, loading, query, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (query.trim().length < 2) return null;

  return (
    <div
      ref={ref}
      className="absolute left-0 top-10 w-full bg-surface-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in"
    >
      <div className="max-h-80 overflow-y-auto divide-y divide-border">
        {loading ? (
          <div className="py-8 flex items-center justify-center text-text-secondary text-sm gap-2">
            <Loader2 size={14} className="animate-spin" /> Mencari...
          </div>
        ) : results.length === 0 ? (
          <div className="py-8 text-center text-text-secondary text-sm">
            Tidak ada hasil untuk &quot;{query}&quot;
          </div>
        ) : (
          results.map((r) => {
            const Icon = iconMap[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => {
                  router.push(r.href);
                  onClose();
                }}
                className={cn(
                  "w-full px-4 py-3 flex gap-3 items-center hover:bg-surface/50 transition-colors text-left"
                )}
              >
                <div className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-accent/10">
                  <Icon size={13} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary leading-tight truncate">{r.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5 truncate">{r.subtitle}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
