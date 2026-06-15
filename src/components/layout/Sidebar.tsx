"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Target,
  Sparkles,
  TrendingUp,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn, getInitials } from "@/utils";
import { mockUser } from "@/lib/mock-data";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/debts", label: "Utang", icon: CreditCard },
  { href: "/goals", label: "Target", icon: Target },
  { href: "/wishlist", label: "Wishlist", icon: Sparkles },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
];

const bottomItems = [
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col bg-surface-low border-r border-border shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-text-primary flex items-center justify-center shrink-0">
          <span className="text-background font-bold text-xs">PF</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary leading-tight">Premium Finance</p>
          <p className="text-[10px] text-accent uppercase tracking-widest">Enterprise Tier</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 group",
                active
                  ? "bg-surface text-text-primary font-medium"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface/60"
              )}
            >
              <Icon size={16} className={cn(active ? "text-text-primary" : "text-accent group-hover:text-text-secondary")} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={12} className="text-accent" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-border space-y-0.5">
        {bottomItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150",
                active ? "bg-surface text-text-primary" : "text-text-secondary hover:text-text-primary hover:bg-surface/60"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2 mt-2 rounded-md hover:bg-surface/60 transition-colors cursor-pointer group">
          <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center border border-border shrink-0">
            <span className="text-xs font-medium text-text-secondary">
              {getInitials(mockUser.full_name)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary font-medium truncate">{mockUser.full_name}</p>
            <p className="text-[10px] text-accent truncate">Admin Access</p>
          </div>
          <LogOut size={14} className="text-accent group-hover:text-danger transition-colors" />
        </div>
      </div>
    </aside>
  );
}
