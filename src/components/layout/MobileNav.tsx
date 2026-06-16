"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, CreditCard, Target, BarChart3 } from "lucide-react";
import { cn } from "@/utils";

const mobileNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/debts", label: "Utang", icon: CreditCard },
  { href: "/goals", label: "Target", icon: Target },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-low/90 backdrop-blur-md border-t border-border">
      <div className="flex items-center justify-around px-2 py-2">
        {mobileNav.map(({ href, label, icon: Icon }) => {
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
      </div>
    </nav>
  );
}
