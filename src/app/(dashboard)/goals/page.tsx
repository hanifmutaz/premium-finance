"use client";

import { useState } from "react";
import { Plus, Target, CheckCircle2, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate, calculateProgress, cn } from "@/utils";
import { calcGoalProgress } from "@/lib/calculations";
import { PriorityBadge, StatusBadge } from "@/components/shared/Badges";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { mockGoals } from "@/lib/mock-data";
import type { Goal } from "@/types";

export default function GoalsPage() {
  const active = mockGoals.filter((g) => g.status === "active");
  const completed = mockGoals.filter((g) => g.status === "completed");

  const totalTarget = active.reduce((s, g) => s + g.target_amount, 0);
  const totalAchieved = active.reduce((s, g) => s + g.current_amount, 0);
  const avgProgress = active.length > 0
    ? active.reduce((s, g) => s + calculateProgress(g.current_amount, g.target_amount), 0) / active.length
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Target Pelunasan</h1>
          <p className="text-sm text-text-secondary mt-0.5">{active.length} target aktif</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-text-primary text-background rounded-md text-xs font-semibold hover:bg-text-primary/90 transition-colors">
          <Plus size={13} />
          Tambah Target
        </button>
      </div>

      {/* Summary */}
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

      {/* Goal cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mockGoals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const { percentage, remaining, monthlyNeeded, weeklyNeeded, monthsLeft, isOnTrack } =
    calcGoalProgress(goal);

  return (
    <div className="card-base p-5 hover:border-accent transition-colors">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            goal.status === "completed" ? "bg-success/10" : "bg-surface"
          )}>
            {goal.status === "completed"
              ? <CheckCircle2 size={16} className="text-success" />
              : <Target size={16} className="text-text-secondary" />
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{goal.name}</p>
            <p className="text-xs text-text-secondary">Deadline: {formatDate(goal.deadline)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={goal.priority} />
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-accent uppercase tracking-wide mb-1">Terkumpul</p>
          <p className="text-base font-semibold text-success tabular-nums">
            {formatCurrency(goal.current_amount, true)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-accent uppercase tracking-wide mb-1">Target</p>
          <p className="text-base font-semibold text-text-primary tabular-nums">
            {formatCurrency(goal.target_amount, true)}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <span className="text-xs text-text-secondary">Progress</span>
          <span className="text-xs font-semibold text-text-primary tabular-nums">
            {Math.round(percentage)}%
          </span>
        </div>
        <ProgressBar
          value={percentage}
          color={percentage >= 80 ? "success" : percentage >= 50 ? "default" : "warning"}
          size="md"
        />
      </div>

      {/* Stats */}
      {goal.status === "active" && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-surface rounded-md p-2.5 text-center">
            <p className="text-[10px] text-accent mb-1">Sisa</p>
            <p className="text-xs font-semibold text-danger tabular-nums">
              {formatCurrency(remaining, true)}
            </p>
          </div>
          <div className="bg-surface rounded-md p-2.5 text-center">
            <p className="text-[10px] text-accent mb-1">/ Bulan</p>
            <p className="text-xs font-semibold text-text-primary tabular-nums">
              {formatCurrency(monthlyNeeded, true)}
            </p>
          </div>
          <div className="bg-surface rounded-md p-2.5 text-center">
            <p className="text-[10px] text-accent mb-1">/ Minggu</p>
            <p className="text-xs font-semibold text-text-primary tabular-nums">
              {formatCurrency(weeklyNeeded, true)}
            </p>
          </div>
        </div>
      )}

      {/* On track indicator */}
      {goal.status === "active" && (
        <div className={cn(
          "flex items-center gap-2 p-2.5 rounded-md text-xs",
          isOnTrack ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
        )}>
          {isOnTrack
            ? <TrendingUp size={12} />
            : <AlertTriangle size={12} />
          }
          {isOnTrack
            ? `On track! Sisa ${monthsLeft} bulan`
            : `Risiko terlambat — perlu ditingkatkan`
          }
        </div>
      )}
    </div>
  );
}
