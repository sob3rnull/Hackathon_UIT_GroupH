import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders the engine's own justification strings as a scannable list.
 *
 * The strings come from lib/mediroute/engine.ts verbatim — this module adds no
 * wording of its own, it only decides whether a line reads as a reason to go
 * ("22 beds free") or a caveat to notice ("No ICU bed free", "ER at 95%
 * capacity"), so the dispatcher isn't ticking a green check next to bad news.
 */

function isCaution(reason: string): boolean {
  if (reason.startsWith("No ")) return true;

  const er = /^ER at (\d+)% capacity$/.exec(reason);
  if (er) return Number(er[1]) >= 75;

  return false;
}

export function ReasonList({
  reasons,
  className,
}: {
  reasons: string[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {reasons.map((reason, index) => {
        const caution = isCaution(reason);
        return (
          <li key={index} className="flex items-start gap-2 text-sm">
            {caution ? (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            ) : (
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
            )}
            <span className={caution ? "text-warning" : undefined}>{reason}</span>
          </li>
        );
      })}
    </ul>
  );
}
