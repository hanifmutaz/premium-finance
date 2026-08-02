"use client";

import { useState, useEffect, useMemo } from "react";
import { Target, TrendingUp, Sparkles, Info } from "lucide-react";
import { formatCurrency, formatDate, formatInputNumber, parseInputNumber, cn } from "@/utils";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { getDebtFreedomStats, type DebtFreedomStats } from "@/lib/db";
import { simulateExtraPayment } from "@/lib/debt-freedom";

export function DebtFreedomDashboard() {
    const [stats, setStats] = useState<DebtFreedomStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [extraDisplay, setExtraDisplay] = useState("");

    useEffect(() => {
        getDebtFreedomStats()
            .then((s) => { setStats(s); setError(null); })
            .catch((err) => {
                console.error("[DebtFreedomDashboard]", err);
                setError(err instanceof Error ? err.message : "Gagal memuat data");
            })
            .finally(() => setLoading(false));
    }, []);

    const extraPayment = Number(parseInputNumber(extraDisplay)) || 0;

    const simulation = useMemo(() => {
        if (!stats) return null;
        return simulateExtraPayment(stats.totalRemaining, stats.avgMonthlyPayment, extraPayment);
    }, [stats, extraPayment]);

    function handleExtraChange(raw: string) {
        const digits = parseInputNumber(raw);
        setExtraDisplay(formatInputNumber(digits));
    }

    if (loading) {
        return (
            <div className="bg-surface-card border border-border rounded-xl p-5">
                <div className="h-24 flex items-center justify-center text-sm text-text-secondary">Memuat progres bebas utang...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-surface-card border border-border rounded-xl p-5">
                <p className="text-xs text-danger">Gagal memuat Debt Freedom Dashboard: {error}</p>
            </div>
        );
    }

    // Gak ada utang sama sekali tercatat (baru pakai app / semua udah kehapus)
    if (!stats || stats.totalInitial === 0) return null;

    const isDebtFree = stats.totalRemaining === 0;

    return (
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                    <Target size={15} className="text-text-secondary" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-text-primary">Debt Freedom Dashboard</p>
                    <p className="text-xs text-text-secondary">Progres menuju bebas utang</p>
                </div>
            </div>

            {isDebtFree ? (
                <div className="mx-5 mb-5 bg-success/10 border border-success/20 rounded-lg px-4 py-5 text-center">
                    <Sparkles size={20} className="text-success mx-auto mb-2" />
                    <p className="text-sm font-semibold text-success">Bebas utang! 🎉</p>
                    <p className="text-xs text-text-secondary mt-1">
                        Total {formatCurrency(stats.totalInitial, true)} yang pernah kamu pinjam udah lunas semua.
                    </p>
                </div>
            ) : (
                <>
                    {/* Stat grid */}
                    <div className="px-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Utang Awal</p>
                            <p className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(stats.totalInitial, true)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Sisa Sekarang</p>
                            <p className="text-sm font-semibold text-danger tabular-nums">{formatCurrency(stats.totalRemaining, true)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Sudah Lunas</p>
                            <p className="text-sm font-semibold text-success tabular-nums">{stats.percentPaid.toFixed(1)}%</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Estimasi Bebas</p>
                            <p className="text-sm font-semibold text-text-primary tabular-nums">
                                {simulation?.baselineDate ? formatDate(simulation.baselineDate.toISOString(), "MMM yyyy") : "—"}
                            </p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="px-5 mt-4">
                        <ProgressBar value={stats.percentPaid} color="success" size="md" />
                    </div>

                    {/* Pace info / fallback notice */}
                    <div className="px-5 mt-3">
                        {stats.avgMonthlyPaymentSource === "none" ? (
                            <p className="text-[10px] text-text-secondary flex items-center gap-1">
                                <Info size={10} className="shrink-0" />
                                Belum ada histori pembayaran 3 bulan terakhir atau cicilan aktif — estimasi tanggal bebas belum bisa dihitung. Isi simulasi di bawah buat lihat proyeksinya.
                            </p>
                        ) : (
                            <p className="text-[10px] text-text-secondary">
                                Berdasarkan rata-rata bayar{" "}
                                <span className="font-medium text-text-primary">{formatCurrency(stats.avgMonthlyPayment, true)}/bulan</span>
                                {stats.avgMonthlyPaymentSource === "installment_fallback" && " (dari total cicilan aktif, belum ada histori pembayaran 3 bulan terakhir)"}
                            </p>
                        )}
                    </div>

                    {/* Simulator */}
                    <div className="mx-5 mt-4 mb-5 bg-surface rounded-lg p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <TrendingUp size={12} className="text-accent" />
                            <p className="text-xs font-semibold text-text-primary">Simulasi: Tambah Bayar per Bulan</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary shrink-0">Rp</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="cth: 500.000"
                                value={extraDisplay}
                                onChange={(e) => handleExtraChange(e.target.value)}
                                className="flex-1 min-w-0 bg-surface-card border border-border rounded-md px-3 py-2 text-sm text-text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                            <span className="text-xs text-text-secondary shrink-0">/bulan</span>
                        </div>

                        {extraPayment > 0 && simulation && (
                            <div className="mt-3 pt-3 border-t border-border">
                                {simulation.monthsAdvanced !== null ? (
                                    simulation.monthsAdvanced > 0 ? (
                                        <p className="text-xs text-text-primary">
                                            Bebas utang maju{" "}
                                            <span className="font-semibold text-success">{simulation.monthsAdvanced} bulan</span>
                                            {simulation.simulatedDate && (
                                                <>
                                                    {" "}— jadi sekitar{" "}
                                                    <span className="font-semibold text-text-primary">
                                                        {formatDate(simulation.simulatedDate.toISOString(), "MMMM yyyy")}
                                                    </span>
                                                </>
                                            )}
                                            .
                                        </p>
                                    ) : (
                                        <p className="text-xs text-text-secondary">
                                            Sisa utang kamu udah bakal lunas kurang dari sebulan dari sekarang, nambah bayar gak ngubah banyak lagi.
                                        </p>
                                    )
                                ) : simulation.simulatedDate ? (
                                    <p className="text-xs text-text-primary">
                                        Dengan tambahan ini, estimasi bebas utang sekitar{" "}
                                        <span className="font-semibold text-text-primary">
                                            {formatDate(simulation.simulatedDate.toISOString(), "MMMM yyyy")}
                                        </span>{" "}
                                        <span className="text-text-secondary">(sebelumnya belum bisa diestimasi karena belum ada histori bayar).</span>
                                    </p>
                                ) : (
                                    <p className="text-xs text-text-secondary">Belum cukup buat mulai nyicil sisa utang. Coba naikkan nominalnya.</p>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}