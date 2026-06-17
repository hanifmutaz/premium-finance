"use client";

import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/utils";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "default";
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Konfirmasi",
  confirmVariant = "default",
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface-card border border-border rounded-xl shadow-2xl animate-fade-in p-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            confirmVariant === "danger" ? "bg-danger/10" : "bg-surface"
          )}>
            <AlertTriangle
              size={18}
              className={confirmVariant === "danger" ? "text-danger" : "text-text-secondary"}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">{description}</p>
          </div>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors shrink-0">
            <X size={15} />
          </button>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-md hover:border-accent hover:text-text-primary transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors",
              confirmVariant === "danger"
                ? "bg-danger text-white hover:bg-danger/90"
                : "bg-text-primary text-background hover:bg-text-primary/90"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
