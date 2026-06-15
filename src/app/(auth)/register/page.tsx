"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Password tidak cocok");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }

    setLoading(true);

    // Demo mode
    toast.success("Akun berhasil dibuat! Silakan login.");
    router.push("/login");
    setLoading(false);
    return;

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.name } },
      });
      if (error) throw error;
      toast.success("Cek email kamu untuk verifikasi akun!");
      router.push("/login");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registrasi gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface-card border border-border rounded-xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Buat akun baru</h1>
        <p className="text-text-secondary text-sm mt-1">Mulai kelola keuangan dengan lebih cerdas</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Nama Lengkap</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nama kamu"
            required
            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="kamu@email.com"
            required
            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 8 karakter"
              required
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-accent hover:text-text-secondary transition-colors"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Konfirmasi Password</label>
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            placeholder="Ulangi password"
            required
            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-text-primary text-background font-medium py-2.5 rounded-md text-sm hover:bg-text-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Membuat akun..." : "Daftar Sekarang"}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-center text-sm text-text-secondary">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-text-primary hover:underline font-medium">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
