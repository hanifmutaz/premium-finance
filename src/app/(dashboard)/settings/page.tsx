"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { User, Bell, Shield, Database, Tag, ChevronRight, Save, Loader2, Smartphone, BellRing, BellOff } from "lucide-react";
import { cn, getInitials } from "@/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { isPushSupported, getPushPermissionStatus, subscribeToPush, unsubscribeFromPush, isSubscribed } from "@/lib/push-notifications";
import { CategoryManager } from "@/components/settings/CategoryManager";

const settingsSections = [
  { id: "profile", label: "Profil", icon: User },
  { id: "categories", label: "Kategori", icon: Tag },
  { id: "notifications", label: "Notifikasi", icon: Bell },
  { id: "security", label: "Keamanan", icon: Shield },
  { id: "data", label: "Data & Export", icon: Database },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? "");
        setName(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name },
      });
      if (error) throw error;
      // Update profiles table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
      }
      toast.success("Profil berhasil diperbarui!");
    } catch {
      toast.error("Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const newPass = (form.elements.namedItem("newPass") as HTMLInputElement).value;
    const confirmPass = (form.elements.namedItem("confirmPass") as HTMLInputElement).value;

    if (newPass !== confirmPass) { toast.error("Password tidak cocok"); return; }
    if (newPass.length < 8) { toast.error("Password minimal 8 karakter"); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      toast.success("Password berhasil diubah!");
      form.reset();
    } catch {
      toast.error("Gagal mengubah password");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-text-secondary text-sm">Memuat...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Pengaturan</h1>
        <p className="text-sm text-text-secondary mt-0.5">Kelola akun dan preferensi kamu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
        <div className="card-base p-2 h-fit space-y-0.5">
          {settingsSections.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left",
                activeSection === id ? "bg-surface text-text-primary font-medium" : "text-text-secondary hover:text-text-primary hover:bg-surface/50"
              )}>
              <Icon size={15} />
              <span className="flex-1">{label}</span>
              <ChevronRight size={13} className="text-accent" />
            </button>
          ))}
        </div>

        <div className="card-base p-6 space-y-6">
          {activeSection === "profile" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Informasi Profil</h2>
                <p className="text-sm text-text-secondary">Perbarui nama dan informasi akun kamu</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center">
                  <span className="text-xl font-semibold text-text-secondary">{getInitials(name || "U")}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{name}</p>
                  <p className="text-xs text-text-secondary">{email}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Nama Lengkap</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Email</label>
                  <input value={email} disabled
                    className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-secondary opacity-60 cursor-not-allowed" />
                  <p className="text-xs text-accent mt-1">Email tidak bisa diubah</p>
                </div>
              </div>
              <button onClick={handleSaveProfile} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-text-primary text-background rounded-md text-sm font-semibold hover:bg-text-primary/90 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </>
          )}

          {activeSection === "categories" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Kelola Kategori</h2>
                <p className="text-sm text-text-secondary">Tambah, ubah, atau hapus kategori transaksi kamu</p>
              </div>
              <CategoryManager />
            </>
          )}

          {activeSection === "notifications" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Pengaturan Notifikasi</h2>
                <p className="text-sm text-text-secondary">Atur reminder dan notifikasi sistem</p>
              </div>

              <PushNotificationCard />

              <div className="space-y-4">
                {[
                  { label: "Jatuh tempo utang", desc: "Notifikasi 7 hari sebelum jatuh tempo", defaultOn: true },
                  { label: "Target pelunasan", desc: "Reminder progress target bulanan", defaultOn: true },
                  { label: "Tagihan rutin", desc: "Pengingat tagihan bulanan", defaultOn: false },
                  { label: "Wishlist update", desc: "Update progress tabungan wishlist", defaultOn: false },
                  { label: "Health score report", desc: "Laporan mingguan financial health", defaultOn: true },
                ].map(({ label, desc, defaultOn }) => (
                  <ToggleRow key={label} label={label} desc={desc} defaultOn={defaultOn} />
                ))}
              </div>
            </>
          )}

          {activeSection === "security" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Keamanan Akun</h2>
                <p className="text-sm text-text-secondary">Ubah password akun kamu</p>
              </div>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Password Baru</label>
                  <input type="password" name="newPass" placeholder="Min. 8 karakter"
                    className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Konfirmasi Password</label>
                  <input type="password" name="confirmPass" placeholder="Ulangi password baru"
                    className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                </div>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 bg-text-primary text-background rounded-md text-sm font-semibold hover:bg-text-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? "Menyimpan..." : "Update Password"}
                </button>
              </form>
            </>
          )}

          {activeSection === "data" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Data & Export</h2>
                <p className="text-sm text-text-secondary">Ekspor data keuangan kamu</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Export semua transaksi (CSV)", desc: "Unduh seluruh riwayat transaksi" },
                  { label: "Export laporan bulanan (PDF)", desc: "Laporan keuangan dalam format PDF" },
                  { label: "Export data utang (Excel)", desc: "Rekap utang dan riwayat pembayaran" },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border">
                    <div>
                      <p className="text-sm text-text-primary font-medium">{label}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
                    </div>
                    <button className="text-xs px-3 py-1.5 border border-border rounded-md text-text-secondary hover:text-text-primary hover:border-accent transition-colors shrink-0">
                      Download
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-danger mb-2">Danger Zone</h3>
                <div className="p-4 border border-danger/30 rounded-lg bg-danger/5">
                  <p className="text-sm text-text-primary font-medium">Hapus Akun</p>
                  <p className="text-xs text-text-secondary mt-1 mb-3">Tindakan ini tidak dapat dibatalkan. Seluruh data akan dihapus permanen.</p>
                  <button className="text-xs px-3 py-1.5 border border-danger/50 text-danger rounded-md hover:bg-danger/10 transition-colors">
                    Hapus Akun
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PushNotificationCard() {
  const [status, setStatus] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function check() {
      const perm = await getPushPermissionStatus();
      setStatus(perm);
      if (perm === "granted") {
        setSubscribed(await isSubscribed());
      }
    }
    check();
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const success = await subscribeToPush();
      if (success) {
        setSubscribed(true);
        setStatus("granted");
        toast.success("Notifikasi HP berhasil diaktifkan!");
      } else {
        toast.error("Izin notifikasi ditolak. Aktifkan dari pengaturan browser.");
        setStatus("denied");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast.success("Notifikasi HP dimatikan");
    } catch {
      toast.error("Gagal menonaktifkan notifikasi");
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported") {
    return (
      <div className="p-4 bg-surface rounded-lg border border-border flex items-center gap-3">
        <BellOff size={18} className="text-accent shrink-0" />
        <div>
          <p className="text-sm text-text-primary font-medium">Browser tidak mendukung</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Gunakan Chrome/Safari terbaru, atau install sebagai PWA di HP kamu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "p-4 rounded-lg border flex items-center justify-between gap-3",
      subscribed ? "bg-success/5 border-success/30" : "bg-surface border-border"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          subscribed ? "bg-success/10" : "bg-surface-card"
        )}>
          {subscribed ? <BellRing size={16} className="text-success" /> : <Smartphone size={16} className="text-text-secondary" />}
        </div>
        <div>
          <p className="text-sm text-text-primary font-medium">Notifikasi Push ke HP</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {subscribed
              ? "Aktif — kamu akan menerima notifikasi langsung di HP"
              : status === "denied"
                ? "Izin ditolak. Aktifkan manual dari pengaturan browser/HP."
                : "Terima notifikasi jatuh tempo & reminder langsung di HP"}
          </p>
        </div>
      </div>
      {status !== "denied" && (
        <button
          onClick={subscribed ? handleDisable : handleEnable}
          disabled={busy}
          className={cn(
            "text-xs px-3 py-1.5 rounded-md font-medium transition-colors shrink-0 flex items-center gap-1.5",
            subscribed
              ? "border border-border text-text-secondary hover:border-danger hover:text-danger"
              : "bg-text-primary text-background hover:bg-text-primary/90"
          )}
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          {subscribed ? "Matikan" : "Aktifkan"}
        </button>
      )}
    </div>
  );
}
function ToggleRow({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border">
      <div className="flex-1 pr-4">
        <p className="text-sm text-text-primary font-medium">{label}</p>
        <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={cn(
          "relative shrink-0 inline-flex items-center rounded-full transition-colors duration-200 h-6 w-11 px-0.5",
          on ? "bg-success" : "bg-border"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200",
            on ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
