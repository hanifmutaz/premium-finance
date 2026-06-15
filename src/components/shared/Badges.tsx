import { cn } from "@/utils";
import type { TransactionStatus, DebtStatus, DebtPriority, GoalStatus } from "@/types";

// ─── Status Badge ─────────────────────────────────────────────────────────────
const statusConfig = {
  completed: { label: "Selesai", dot: "bg-success", text: "text-success", bg: "bg-success/10" },
  pending: { label: "Tertunda", dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
  failed: { label: "Gagal", dot: "bg-danger", text: "text-danger", bg: "bg-danger/10" },
  active: { label: "Aktif", dot: "bg-success", text: "text-success", bg: "bg-success/10" },
  overdue: { label: "Jatuh Tempo", dot: "bg-danger", text: "text-danger", bg: "bg-danger/10" },
  paused: { label: "Dijeda", dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
};

interface StatusBadgeProps {
  status: TransactionStatus | DebtStatus | GoalStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-medium",
      config.bg, config.text,
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
    )}>
      <span className={cn("rounded-full shrink-0", config.dot, size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5")} />
      {config.label}
    </span>
  );
}

// ─── Priority Badge ───────────────────────────────────────────────────────────
const priorityConfig = {
  high: { label: "Tinggi", text: "text-danger", bg: "bg-danger/10" },
  medium: { label: "Sedang", text: "text-warning", bg: "bg-warning/10" },
  low: { label: "Rendah", text: "text-text-secondary", bg: "bg-surface" },
};

export function PriorityBadge({ priority }: { priority: DebtPriority }) {
  const config = priorityConfig[priority];
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      config.bg, config.text
    )}>
      {config.label}
    </span>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────
const typeConfig = {
  income: { label: "Pemasukan", text: "text-success", bg: "bg-success/10" },
  expense: { label: "Pengeluaran", text: "text-danger", bg: "bg-danger/10" },
  debt_payment: { label: "Bayar Utang", text: "text-warning", bg: "bg-warning/10" },
  transfer: { label: "Transfer", text: "text-text-secondary", bg: "bg-surface" },
};

export function TypeBadge({ type }: { type: keyof typeof typeConfig }) {
  const config = typeConfig[type] ?? typeConfig.transfer;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      config.bg, config.text
    )}>
      {config.label}
    </span>
  );
}

// ─── Grade Badge ──────────────────────────────────────────────────────────────
const gradeConfig = {
  A: "text-success bg-success/10",
  B: "text-lime-400 bg-lime-400/10",
  C: "text-warning bg-warning/10",
  D: "text-orange-400 bg-orange-400/10",
  E: "text-danger bg-danger/10",
};

export function GradeBadge({ grade, size = "md" }: { grade: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={cn(
      "inline-flex items-center justify-center font-bold rounded-lg",
      gradeConfig[grade as keyof typeof gradeConfig] ?? "text-text-secondary bg-surface",
      size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-16 h-16 text-3xl" : "w-10 h-10 text-lg"
    )}>
      {grade}
    </span>
  );
}
