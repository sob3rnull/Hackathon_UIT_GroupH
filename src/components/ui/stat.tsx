import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const valueTones: Record<Tone, string> = {
  neutral: "text-foreground",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * A single headline number. Used for the summary strips at the top of the
 * hospital, fleet and history screens so the state of the world is readable
 * without parsing a table.
 */
export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-card border border-border bg-surface p-4",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("text-2xl font-semibold tabular-nums", valueTones[tone])}>
        {value}
      </p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function StatGrid({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}
      {...props}
    />
  );
}
