"use client";

import { TrendingUp, ShieldCheck, AlertTriangle } from "lucide-react";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { GradeBadge } from "@/components/shared/Badges";
import type { FinancialScore } from "@/types";

const metrics = [
  { key: "savings_ratio", label: "Savings Ratio", hint: "Target > 20%" },
  { key: "debt_ratio", label: "Debt-to-Income", hint: "Target < 30%", invert: true },
  { key: "expense_ratio", label: "Expense Ratio", hint: "Target < 60%", invert: true },
  { key: "cashflow_stability", label: "Cashflow Stability", hint: "Semakin tinggi semakin baik" },
  { key: "target_achievement", label: "Target Achievement", hint: "Progress rata-rata target" },
];

export function HealthScoreWidget({ score }: { score: FinancialScore }) {
  return (
    <div className="card-base p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Financial Health</h3>
          <p className="text-xs text-text-secondary mt-0.5">Penilaian otomatis sistem</p>
        </div>
        <ShieldCheck size={16} className="text-accent" />
      </div>

      {/* Score + Grade */}
      <div className="flex items-center gap-4 mb-5 p-4 bg-surface rounded-lg border border-border">
        <GradeBadge grade={score.grade} size="lg" />
        <div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{score.score}</p>
          <p className="text-xs text-text-secondary">dari 100 poin</p>
          <p className="text-xs text-success flex items-center gap-1 mt-1">
            <TrendingUp size={10} />
            Top 5% earner di region kamu
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3 mb-4">
        {metrics.map(({ key, label, hint, invert }) => {
          const value = score[key as keyof FinancialScore] as number;
          const displayValue = invert ? 100 - value : value;
          const color = displayValue >= 70 ? "success" : displayValue >= 45 ? "default" : "warning";
          return (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-text-secondary">{label}</span>
                <span className="text-xs font-medium text-text-primary tabular-nums">{value}%</span>
              </div>
              <ProgressBar value={displayValue} color={color} size="sm" />
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {score.recommendations.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Rekomendasi</p>
          {score.recommendations.slice(0, 2).map((rec, i) => (
            <div key={i} className="flex gap-2">
              <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">{rec}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
