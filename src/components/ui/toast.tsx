"use client";

import * as React from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal toast system — context + a fixed stack, no dependency.
 *
 * Used for the write confirmations that used to be invisible: a hospital
 * freeing a bed, a crew advancing its status, a dispatch landing. Errors keep
 * using the inline ErrorState where the failure has a place on the page;
 * toasts are for things that succeed and then get out of the way.
 */

type Tone = "success" | "danger" | "info";

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

interface ToastOptions {
  title: string;
  description?: string;
  tone?: Tone;
}

const ToastContext = React.createContext<((options: ToastOptions) => void) | null>(
  null,
);

const DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, tone = "success" }: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, title, description, tone }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((entry) => (
          <ToastCard key={entry.id} toast={entry} onDismiss={() => dismiss(entry.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Returns a `toast({ title })` function. Safe to call outside a provider. */
export function useToast() {
  return React.useContext(ToastContext) ?? (() => {});
}

const toneStyles: Record<Tone, { ring: string; icon: React.ReactNode }> = {
  success: {
    ring: "border-success/40",
    icon: <Check className="size-4 text-success" />,
  },
  danger: {
    ring: "border-danger/40",
    icon: <AlertTriangle className="size-4 text-danger" />,
  },
  info: {
    ring: "border-accent/40",
    icon: <Info className="size-4 text-accent" />,
  },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { ring, icon } = toneStyles[toast.tone];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-card border bg-surface p-3.5 shadow-lg",
        "toast-enter",
        ring,
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs text-muted">{toast.description}</p>
        ) : null}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
