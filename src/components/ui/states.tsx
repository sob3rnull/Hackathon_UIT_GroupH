import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden
      className={cn("size-4 animate-spin", className)}
      strokeWidth={2.5}
    />
  );
}

/** Grey bars shown while the list loads. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-card bg-surface-muted"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-12 text-center">
      {icon ? <div className="text-muted">{icon}</div> : null}
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-danger/30 bg-danger/8 px-4 py-3 text-sm">
      <p className="flex-1 text-danger">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="font-medium text-danger underline underline-offset-2"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
