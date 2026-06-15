"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, Menu, X } from "lucide-react";
import { cn } from "@/utils";
import { mockNotifications } from "@/lib/mock-data";
import { NotificationPanel } from "@/components/shared/NotificationPanel";

const pageTitles: Record<string, string> = {
  "/dashboard": "Financial Overview",
  "/transactions": "Transaksi",
  "/debts": "Manajemen Utang",
  "/goals": "Target Pelunasan",
  "/wishlist": "Wishlist",
  "/forecast": "Forecast Keuangan",
  "/reports": "Laporan",
  "/settings": "Pengaturan",
};

export function Header() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [showNotif, setShowNotif] = useState(false);

  const title = pageTitles[pathname] ?? "Premium Finance";
  const unread = mockNotifications.filter((n) => !n.is_read).length;

  return (
    <header className="h-14 glass flex items-center gap-4 px-4 md:px-6 shrink-0 sticky top-0 z-30">
      {/* Title */}
      <h1 className="text-base font-semibold text-text-primary hidden md:block">
        {title}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden sm:flex items-center">
        <Search size={14} className="absolute left-3 text-accent pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Global search..."
          className="w-56 md:w-72 bg-surface border border-border rounded-md pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent focus:w-80 transition-all duration-200"
        />
        <kbd className="absolute right-3 text-[10px] text-accent border border-border rounded px-1 hidden md:block">⌘K</kbd>
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setShowNotif(!showNotif)}
          className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface transition-colors text-text-secondary hover:text-text-primary"
        >
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
          )}
        </button>
        {showNotif && (
          <NotificationPanel
            notifications={mockNotifications}
            onClose={() => setShowNotif(false)}
          />
        )}
      </div>
    </header>
  );
}
