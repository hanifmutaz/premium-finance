"use client";

import { useState } from "react";
import { Plus, Check, X } from "lucide-react";

interface Props {
  onAdd: (amount: number) => Promise<void>;
  label?: string;
}

export function AddSavingButton({ onAdd, label = "Tambah Tabungan" }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const amount = parseFloat(value);
    if (!amount || amount <= 0) return;
    setSubmitting(true);
    try {
      await onAdd(amount);
      setValue("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-border text-xs font-medium text-accent hover:border-accent hover:text-text-primary transition-colors"
      >
        <Plus size={13} /> {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { setOpen(false); setValue(""); }
        }}
        placeholder="Jumlah (Rp)"
        className="flex-1 bg-surface border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="shrink-0 w-7 h-7 rounded-md bg-success/10 text-success flex items-center justify-center hover:bg-success/20 transition-colors disabled:opacity-50"
      >
        <Check size={13} />
      </button>
      <button
        onClick={() => { setOpen(false); setValue(""); }}
        className="shrink-0 w-7 h-7 rounded-md bg-surface text-text-secondary flex items-center justify-center hover:text-danger transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
}
