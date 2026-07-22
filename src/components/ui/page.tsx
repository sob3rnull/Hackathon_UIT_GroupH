import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The one place page chrome is defined, so every role screen shares the same
 * width, gutters and heading rhythm instead of each route inventing its own.
 */

export function PageShell({
  className,
  wide,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 py-8 sm:py-10",
        wide ? "max-w-7xl" : "max-w-6xl",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <div className="flex items-center gap-2">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-3xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Groups a run of cards under a quiet label, for the stacked dashboards. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
