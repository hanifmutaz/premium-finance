"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils";
import { getCategories, addCategory, updateCategory, deleteCategory } from "@/lib/db";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { Category } from "@/types";

const DEFAULT_COLORS = ["#64748B", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#EC4899", "#14B8A6"];

function CategorySection({ type, label }: { type: "income" | "expense"; label: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try { setCategories((await getCategories(type)) as Category[]); }
    catch { toast.error("Gagal memuat kategori"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [type]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await addCategory({
        name: newName.trim(), type,
        color: DEFAULT_COLORS[categories.length % DEFAULT_COLORS.length],
      });
      setNewName(""); setAdding(false);
      toast.success("Kategori ditambahkan");
      load();
    } catch { toast.error("Gagal menambah kategori"); }
    finally { setBusy(false); }
  }

  async function handleRename(cat: Category) {
    if (!editName.trim()) return;
    setBusy(true);
    try {
      await updateCategory(cat.id, { name: editName.trim(), color: cat.color });
      setEditingId(null);
      toast.success("Kategori diperbarui");
      load();
    } catch { toast.error("Gagal memperbarui kategori"); }
    finally { setBusy(false); }
  }

  async function handleDelete(cat: Category) {
    try {
      await deleteCategory(cat.id);
      toast.success("Kategori dihapus");
      load();
    } catch {
      toast.error("Gagal menghapus — coba lagi");
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-2.5">{label}</h3>
      {loading ? (
        <div className="py-6 text-center text-text-secondary text-xs">Memuat...</div>
      ) : (
        <div className="space-y-1.5">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2.5 p-2.5 bg-surface rounded-md border border-border group">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || "#64748B" }} />
              {editingId === cat.id ? (
                <>
                  <input
                    autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(cat); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 bg-input border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                  <button onClick={() => handleRename(cat)} disabled={busy} className="text-success hover:text-success/80 shrink-0">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-text-secondary hover:text-danger shrink-0">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-text-primary">{cat.name}</span>
                  <button
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                    className="text-text-secondary opacity-0 group-hover:opacity-100 hover:text-text-primary transition-opacity shrink-0"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    className="text-text-secondary opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}

          {adding ? (
            <div className="flex items-center gap-2 p-2.5 bg-surface rounded-md border border-accent">
              <input
                autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
                placeholder="Nama kategori baru"
                className="flex-1 bg-input border border-border rounded px-2 py-1 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent"
              />
              <button onClick={handleAdd} disabled={busy} className="text-success hover:text-success/80 shrink-0">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={() => { setAdding(false); setNewName(""); }} className="text-text-secondary hover:text-danger shrink-0">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-border text-xs font-medium text-accent hover:border-accent hover:text-text-primary transition-colors"
            >
              <Plus size={13} /> Tambah Kategori {label}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus kategori?"
        description={`"${deleteTarget?.name}" akan dihapus. Transaksi yang masih pakai kategori ini bakal jadi tanpa kategori (bukan ikut terhapus).`}
        confirmLabel="Hapus"
        confirmVariant="danger"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export function CategoryManager() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <CategorySection type="income" label="Pemasukan" />
      <CategorySection type="expense" label="Pengeluaran" />
    </div>
  );
}
