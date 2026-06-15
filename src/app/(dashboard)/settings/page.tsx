"use client";

import { useState } from "react";
import { User, Bell, Shield, Palette, Database, ChevronRight, Save } from "lucide-react";
import { cn, getInitials } from "@/utils";
import { mockUser } from "@/lib/mock-data";
import { toast } from "sonner";

const settingsSections = [
  { id: "profile", label: "Profil", icon: User },
  { id: "notifications", label: "Notifikasi", icon: Bell },
  { id: "security", label: "Keamanan", icon: Shield },
  { id: "appearance", label: "Tampilan", icon: Palette },
  { id: "data", label: "Data & Export", icon: Database },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const [name, setName] = useState(mockUser.full_name);
  const [email, setEmail] = useState(mockUser.email);

  function handleSave() {
    toast.success("Pengaturan berhasil disimpan!");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Pengaturan</h1>
        <p className="text-sm text-text-secondary mt-0.5">Kelola akun dan preferensi kamu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
        {/* Sidebar nav */}
        <div className="card-base p-2 h-fit space-y-0.5">
          {settingsSections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left",
                activeSection === id
                  ? "bg-surface text-text-primary font-medium"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface/50"
              )}
            >
              <Icon size={15} />
              <span className="flex-1">{label}</span>
              <ChevronRight size={13} className="text-accent" />
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card-base p-6 space-y-6">
          {activeSection === "profile" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Informasi Profil</h2>
                <p className="text-sm text-text-secondary">Perbarui nama dan email kamu</p>
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center">
                  <span className="text-xl font-semibold text-text-secondary">
                    {getInitials(name)}
                  </span>
                </div>
                <div>
                  <button className="text-sm text-text-primary border border-border px-3 py-1.5 rounded-md hover:border-accent transition-colors">
                    Ubah Foto
                  </button>
                  <p className="text-xs text-text-secondary mt-1">JPG, PNG max 2MB</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Nama Lengkap</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Mata Uang</label>
                  <select className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors">
                    <option value="IDR">IDR — Rupiah Indonesia</option>
                    <option value="USD">USD — US Dollar</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2.5 bg-text-primary text-background rounded-md text-sm font-semibold hover:bg-text-primary/90 transition-colors"
              >
                <Save size={14} />
                Simpan Perubahan
              </button>
            </>
          )}

          {activeSection === "notifications" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Pengaturan Notifikasi</h2>
                <p className="text-sm text-text-secondary">Atur reminder dan notifikasi sistem</p>
              </div>
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
                <p className="text-sm text-text-secondary">Ubah password dan pengaturan keamanan</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Password Lama</label>
                  <input type="password" className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Password Baru</label>
                  <input type="password" className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Konfirmasi Password</label>
                  <input type="password" className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                </div>
                <button onClick={handleSave} className="px-4 py-2.5 bg-text-primary text-background rounded-md text-sm font-semibold hover:bg-text-primary/90 transition-colors">
                  Update Password
                </button>
              </div>
            </>
          )}

          {activeSection === "data" && (
            <>
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Data & Export</h2>
                <p className="text-sm text-text-secondary">Ekspor atau hapus data keuangan kamu</p>
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
                  <p className="text-sm text-text-primary font-medium">Hapus Semua Data</p>
                  <p className="text-xs text-text-secondary mt-1 mb-3">
                    Tindakan ini tidak dapat dibatalkan. Seluruh data akan dihapus permanen.
                  </p>
                  <button className="text-xs px-3 py-1.5 border border-danger/50 text-danger rounded-md hover:bg-danger/10 transition-colors">
                    Hapus Semua Data
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

function ToggleRow({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border">
      <div>
        <p className="text-sm text-text-primary font-medium">{label}</p>
        <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={cn(
          "relative w-10 h-5.5 rounded-full transition-colors shrink-0",
          on ? "bg-success" : "bg-surface-card border border-border"
        )}
        style={{ height: "22px", width: "40px" }}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
            on ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
