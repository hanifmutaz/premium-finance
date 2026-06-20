"use client";

import { useEffect, useRef } from "react";
import { X, Bell, AlertCircle, Target, ShoppingBag, Info } from "lucide-react";
import { cn, formatDateRelative } from "@/utils";
import type { Notification } from "@/types";

const iconMap = {
  debt_due: AlertCircle,
  bill_due: AlertCircle,
  goal_reminder: Target,
  wishlist: ShoppingBag,
  savings: Target,
  system: Info,
};

interface Props {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 w-80 bg-surface-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-text-secondary" />
          <span className="text-sm font-semibold text-text-primary">Notifikasi</span>
          <span className="text-xs bg-danger text-white px-1.5 py-0.5 rounded-full">
            {notifications.filter((n) => !n.is_read).length}
          </span>
        </div>
        <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-border">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-text-secondary text-sm">
            Tidak ada notifikasi
          </div>
        ) : (
          notifications.map((notif) => {
            const Icon = iconMap[notif.type] ?? Info;
            return (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && onMarkRead(notif.id)}
                className={cn(
                  "px-4 py-3 flex gap-3 hover:bg-surface/50 transition-colors cursor-pointer",
                  !notif.is_read && "bg-surface/30"
                )}
              >
                <div className={cn(
                  "mt-0.5 shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
                  notif.type === "debt_due" ? "bg-danger/10" :
                    notif.type === "goal_reminder" ? "bg-success/10" : "bg-accent/10"
                )}>
                  <Icon size={13} className={cn(
                    notif.type === "debt_due" ? "text-danger" :
                      notif.type === "goal_reminder" ? "text-success" : "text-accent"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium text-text-primary leading-tight">{notif.title}</p>
                    {!notif.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{notif.message}</p>
                  <p className="text-[10px] text-accent mt-1">{formatDateRelative(notif.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-border">
        <button onClick={onMarkAllRead} className="text-xs text-accent hover:text-text-primary transition-colors w-full text-center">
          Tandai semua sebagai dibaca
        </button>
      </div>
    </div>
  );
}