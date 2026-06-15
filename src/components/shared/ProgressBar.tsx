import { cn } from "@/utils";

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  className?: string;
  trackClassName?: string;
  color?: "default" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  animated?: boolean;
}

const colorMap = {
  default: "bg-text-secondary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function ProgressBar({
  value,
  className,
  trackClassName,
  color = "default",
  size = "sm",
  animated = false,
}: ProgressBarProps) {
  const pct = Math.min(Math.max(value, 0), 100);
  const barColor =
    color === "default"
      ? pct >= 80
        ? "bg-success"
        : pct >= 50
        ? "bg-text-secondary"
        : "bg-warning"
      : colorMap[color];

  return (
    <div
      className={cn(
        "w-full bg-surface rounded-full overflow-hidden",
        size === "sm" ? "h-1.5" : "h-2.5",
        trackClassName
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700 ease-out",
          barColor,
          animated && "animate-pulse",
          className
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
