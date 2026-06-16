"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, Menu } from "lucide-react";
import { NotificationPanel } from "@/components/shared/NotificationPanel";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import type { Notification } from "@/types";

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
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const title = pageTitles[pathname] ?? "NOXOMOR Ledger";

  useEffect(() => {
    async function loadNotifs() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setNotifications(data as Notification[]);
    }
    loadNotifs();
  }, []);

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="h-14 glass flex items-center gap-4 px-4 md:px-6 shrink-0 sticky top-0 z-30">
      <h1 className="text-base font-semibold text-text-primary hidden md:block">{title}</h1>
      <div className="flex-1" />

      <div className="relative hidden sm:flex items-center">
        <Search size={14} className="absolute left-3 text-accent pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Global search..."
          className="w-56 md:w-72 bg-surface border border-border rounded-md pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-all duration-200"
        />
      </div>

      <div className="relative">
        <button
          onClick={() => setShowNotif(!showNotif)}
          className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface transition-colors text-text-secondary hover:text-text-primary"
        >
          <Bell size={16} />
          {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />}
        </button>
        {showNotif && (
          <NotificationPanel notifications={notifications} onClose={() => setShowNotif(false)} />
        )}
      </div>
    </header>
  );
}
