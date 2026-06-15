"use client";

import { Plus, Target } from "lucide-react";
import { formatCurrency, calculateProgress, formatDate } from "@/utils";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { PriorityBadge } from "@/components/shared/Badges";
import type { Goal } from "@/types";

export function FinancialGoalsWidget({ goals }: { goals: Goal[] }) {
  const active = goals.filter((g) => g.status === "active");

  return (
    <div className="card-base p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Financial Goals</h3>
          <p className="text-xs text-text-secondary mt-0.5">{active.length} target aktif</p>
        </div>
        <button className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 border border-border rounded-md px-2.5 py-1.5">
          <Plus size={12} />
          Tambah
        </button>
      </div>

      <div className="flex-1 space-y-4">
        {active.map((goal) => {
          const pct = calculateProgress(goal.current_amount, goal.target_amount);
          const remaining = goal.target_amount - goal.current_amount;
          return (
            <div key={goal.id} className="group hover:bg-surface/30 -mx-1 px-1 py-1 rounded-md transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{goal.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-secondary tabular-nums">
                      {formatCurrency(goal.current_amount, true)}
                    </span>
                    <span className="text-accent text-xs">/</span>
                    <span className="text-xs text-text-secondary tabular-nums">
                      {formatCurrency(goal.target_amount, true)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={goal.priority} />
                  <span className="text-xs font-semibold text-text-primary tabular-nums">
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>
              <ProgressBar
                value={pct}
                color={pct >= 80 ? "success" : pct >= 50 ? "default" : "warning"}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-accent">
                  Kurang {formatCurrency(remaining, true)}
                </span>
                <span className="text-[10px] text-accent">
                  {formatDate(goal.deadline, "MMM yyyy")}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <button className="mt-4 w-full py-2 border border-border text-text-secondary text-xs font-medium rounded-md hover:border-accent hover:text-text-primary transition-colors">
        Lihat Semua Target
      </button>
    </div>
  );
}
