"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils";
import { addGoal } from "@/lib/db";

interface Props { open: boolean; onClose: () => void; }

export function GoalFormModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", target_amount: "", deadline: "", priority: "medium", notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.target_amount || !form.deadline) {
      toast.error("Nama, target nominal, dan deadline wajib diisi");
      return;
    }
    setLoading(true);
    try {
      await addGoal({
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        deadline: form.deadline,
        priority: form.priority as "low" | "medium" | "high",
        notes: form.notes || undefined,
      });
      toast.success("Target berhasil ditambahkan");
      setForm({ name: "", target_amount: "", deadline: "", priority: "medium", notes: "" });
      onClose();
    } catch { toast.error("Gagal menyimpan target"); }
    finally { setLoading(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-surface-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface-card">
          <h2 className="text-sm font-semibold text-text-primary">Tambah Target</h2>
          <button onClick={onClose} className="text-accent hover:text-text-primary transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Nama Target *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="mis. Lunas Utang KPR, Dana Darurat..."
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Target Nominal *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-sm">Rp</span>
              <input type="number" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                placeholder="0"
                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors tabular-nums" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Deadline *</label>
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Prioritas</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface rounded-lg">
              {[{ v: "low", l: "Rendah" }, { v: "medium", l: "Sedang" }, { v: "high", l: "Tinggi" }].map(({ v, l }) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, priority: v })}
                  className={cn("py-1.5 rounded-md text-xs font-medium transition-colors",
                    form.priority === v ? "bg-text-primary text-background" : "text-text-secondary hover:text-text-primary"
                  )}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Catatan (opsional)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Catatan tambahan..." rows={2}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-md hover:border-accent hover:text-text-primary transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-text-primary text-background text-sm font-semibold rounded-md hover:bg-text-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
