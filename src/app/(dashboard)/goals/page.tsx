"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Plus, Target, CheckCircle2, TrendingUp, AlertTriangle, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, calculateProgress, cn } from "@/utils";
import { calcGoalProgress } from "@/lib/calculations";
import { PriorityBadge } from "@/components/shared/Badges";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getGoals, deleteGoal } from "@/lib/db";
import { toast } from "sonner";
import type { Goal } from "@/types";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setGoals(await getGoals()); }
    catch { toast.error("Gagal memuat target"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const active = goals.filter((g) => g.status === "active");
  const totalTarget = active.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalAchieved = active.reduce((s, g) => s + Number(g.current_amount), 0);
  const avgProgress = active.length > 0
    ? active.reduce((s, g) => s + calculateProgress(Number(g.current_amount), Number(g.target_amount)), 0) / active.length
    : 0;

  async function handleDelete(id: string) {
    try { await deleteGoal(id); toast.success("Target dihapus"); load(); }
    catch { toast.error("Gagal menghapus"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Target Pelunasan</h1>
          <p className="text-sm text-text-secondary mt-0.5">{active.length} target aktif</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Total Target</p>
          <p className="text-2xl font-semibold text-text-primary tabular-nums">{formatCurrency(totalTarget, true)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Sudah Tercapai</p>
          <p className="text-2xl font-semibold text-success tabular-nums">{formatCurrency(totalAchieved, true)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Avg. Progress</p>
          <p className="text-2xl font-semibold text-text-primary tabular-nums">{Math.round(avgProgress)}%</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-text-secondary text-sm">Memuat...</div>
      ) : goals.length === 0 ? (
        <EmptyState icon={Target} title="Belum ada target" description="Tambah target keuangan pertama kamu." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const { percentage, remaining, monthlyNeeded, weeklyNeeded, monthsLeft, isOnTrack } = calcGoalProgress(goal);
            return (
              <div key={goal.id} className="card-base p-5 hover:border-accent transition-colors group">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      goal.status === "completed" ? "bg-success/10" : "bg-surface"
                    )}>
                      {goal.status === "completed"
                        ? <CheckCircle2 size={16} className="text-success" />
                        : <Target size={16} className="text-text-secondary" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{goal.name}</p>
                      <p className="text-xs text-text-secondary">Deadline: {formatDate(goal.deadline)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={goal.priority} />
                    <button onClick={() => setDeleteId(goal.id)}
                      className="opacity-0 group-hover:opacity-100 text-accent hover:text-danger transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-[10px] text-accent uppercase mb-1">Terkumpul</p>
                    <p className="text-base font-semibold text-success tabular-nums">{formatCurrency(Number(goal.current_amount), true)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-accent uppercase mb-1">Target</p>
                    <p className="text-base font-semibold text-text-primary tabular-nums">{formatCurrency(Number(goal.target_amount), true)}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-text-secondary">Progress</span>
                    <span className="text-xs font-semibold tabular-nums">{Math.round(percentage)}%</span>
                  </div>
                  <ProgressBar value={percentage} color={percentage >= 80 ? "success" : percentage >= 50 ? "default" : "warning"} size="md" />
                </div>

                {goal.status === "active" && (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: "Sisa", val: remaining, color: "text-danger" },
                        { label: "/ Bulan", val: monthlyNeeded, color: "text-text-primary" },
                        { label: "/ Minggu", val: weeklyNeeded, color: "text-text-primary" },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="bg-surface rounded-md p-2.5 text-center">
                          <p className="text-[10px] text-accent mb-1">{label}</p>
                          <p className={cn("text-xs font-semibold tabular-nums", color)}>{formatCurrency(val, true)}</p>
                        </div>
                      ))}
                    </div>
                    <div className={cn("flex items-center gap-2 p-2.5 rounded-md text-xs",
                      isOnTrack ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    )}>
                      {isOnTrack ? <TrendingUp size={12} /> : <AlertTriangle size={12} />}
                      {isOnTrack ? `On track! Sisa ${monthsLeft} bulan` : "Risiko terlambat — perlu ditingkatkan"}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog open={!!deleteId} title="Hapus Target?" description="Target ini akan dihapus permanen."
        confirmLabel="Hapus" confirmVariant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
