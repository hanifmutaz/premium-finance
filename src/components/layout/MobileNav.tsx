"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowLeftRight, CreditCard, MoreHorizontal,
  Target, Sparkles, TrendingUp, BarChart3, Settings, X,
  Handshake, CalendarRange, Repeat, Wallet,
} from "lucide-react";
import { cn } from "@/utils";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/budget", label: "Budget", icon: CalendarRange },
];

const moreNav = [
  { href: "/accounts", label: "Akun", icon: Wallet },
  { href: "/recurring", label: "Berulang", icon: Repeat },
  { href: "/debts", label: "Utang", icon: CreditCard },
  { href: "/receivables", label: "Piutang", icon: Handshake },
  { href: "/goals", label: "Target", icon: Target },
  { href: "/wishlist", label: "Wishlist", icon: Sparkles },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = moreNav.some((item) => pathname.startsWith(item.href));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-low/95 backdrop-blur-md border-t border-border">
        <div className="flex items-center justify-around px-2 py-2">
          {mainNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                className={cn("flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors",
                  active ? "text-text-primary" : "text-accent"
                )}>
                <Icon size={18} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(true)}
            className={cn("flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors",
              isMoreActive ? "text-text-primary" : "text-accent"
            )}
          >
            <MoreHorizontal size={18} />
            <span className="text-[10px] font-medium">Lainnya</span>
          </button>
        </div>
      </nav>

      {showMore && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMore(false)} />
          <div className="relative w-full bg-surface-card border-t border-border rounded-t-2xl animate-fade-in pb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Menu Lainnya</h2>
              <button onClick={() => setShowMore(false)} className="text-accent hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4">
              {moreNav.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link key={href} href={href} onClick={() => setShowMore(false)}
                    className={cn("flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors",
                      active ? "bg-surface border-accent text-text-primary" : "border-border text-text-secondary hover:border-accent hover:text-text-primary"
                    )}>
                    <Icon size={20} />
                    <span className="text-xs font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}