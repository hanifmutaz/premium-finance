"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { toast } from "sonner";
import { NotificationPanel } from "@/components/shared/NotificationPanel";
import { SearchDropdown } from "@/components/shared/SearchDropdown";
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  subscribeToNotifications, globalSearch,
} from "@/lib/db";
import type { Notification } from "@/types";
import type { SearchResult } from "@/lib/db";

const pageTitles: Record<string, string> = {
  "/dashboard": "Financial Overview",
  "/accounts": "Sumber Dana",
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const title = pageTitles[pathname] ?? "NOXOMOR Ledger";

  // Debounced global search — tunggu 300ms setelah user berhenti ngetik
  // biar gak nembak query tiap keystroke.
  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await globalSearch(search);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    async function loadNotifs() {
      try {
        const data = await getNotifications();
        setNotifications(data);
      } catch {
        // belum login / session expired — biarin kosong, jangan crash header
      }
    }
    loadNotifs();
  }, []);

  // Live update: notif baru (misal dari cron check-due-reminders) langsung
  // muncul tanpa perlu refresh halaman.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    subscribeToNotifications((notif) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev; // hindari dobel
        return [notif, ...prev];
      });
      toast(notif.title, { description: notif.message });
    })
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      })
      .catch(() => {
        // belum login — gak masalah, gak ada yang perlu di-subscribe
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const unread = notifications.filter((n) => !n.is_read).length;

  async function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await markNotificationRead(id);
    } catch {
      // gagal sync ke server, biarin state lokal tetap kebaca
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      // gagal sync ke server, biarin state lokal tetap kebaca
    }
  }

  return (
    <header className="h-14 glass flex items-center gap-3 px-4 md:px-6 shrink-0 sticky top-0 z-30">
      <h1 className="text-base font-semibold text-text-primary truncate">{title}</h1>

      <div className="flex-1" />

      <div className="relative hidden sm:flex items-center">
        <Search size={14} className="absolute left-3 text-accent pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowSearch(true);
          }}
          onFocus={() => setShowSearch(true)}
          placeholder="Cari utang, transaksi, goals..."
          className="w-56 md:w-72 bg-surface border border-border rounded-md pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-all duration-200"
        />
        {showSearch && (
          <SearchDropdown
            results={searchResults}
            loading={searchLoading}
            query={search}
            onClose={() => setShowSearch(false)}
          />
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowNotif(!showNotif)}
          className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface transition-colors text-text-secondary hover:text-text-primary shrink-0"
        >
          <Bell size={16} />
          {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />}
        </button>
        {showNotif && (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setShowNotif(false)}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
        )}
      </div>
    </header>
  );
}