"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Demo mode: bypass auth
    if (email === "demo@premium.finance" || email.length > 0) {
      toast.success("Login berhasil! Selamat datang.");
      router.push("/dashboard");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
      toast.success("Login berhasil!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login gagal";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface-card border border-border rounded-xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Masuk ke akun</h1>
        <p className="text-text-secondary text-sm mt-1">Kelola keuangan dengan lebih cerdas</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kamu@email.com"
            required
            className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent-2 focus:ring-1 focus:ring-accent/20 transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm text-text-secondary">Password</label>
            <Link href="/forgot-password" className="text-xs text-accent hover:text-text-secondary transition-colors">
              Lupa password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-text-primary placeholder:text-accent focus:outline-none focus:border-accent-2 focus:ring-1 focus:ring-accent/20 transition-colors"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-text-primary text-background font-medium py-2.5 rounded-md text-sm hover:bg-text-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Masuk..." : "Masuk"}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-center text-sm text-text-secondary">
          Belum punya akun?{" "}
          <Link href="/register" className="text-text-primary hover:underline font-medium">
            Daftar sekarang
          </Link>
        </p>
      </div>

      {/* Demo hint */}
      <div className="mt-4 p-3 bg-surface rounded-md border border-border">
        <p className="text-xs text-text-secondary text-center">
          <span className="text-accent font-medium">Demo mode:</span> masukkan email apapun untuk masuk
        </p>
      </div>
    </div>
  );
}
