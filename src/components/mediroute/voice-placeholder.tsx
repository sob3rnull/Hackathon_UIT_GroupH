import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stand-in for the crew's own trained voice model — deliberately not wired
 * to the browser's SpeechRecognition (see voice-input.tsx, used on the
 * dispatcher's optional note field). Styled to match that button so swapping
 * this out for the real integration later is a drop-in, not a redesign.
 */
export function VoicePlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        disabled
        title="Voice input — coming soon"
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium",
          "border border-dashed border-border bg-surface text-muted",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        <Mic className="size-4" />
        Dictate
      </button>
      <p className="text-xs text-muted">Voice input — coming soon.</p>
    </div>
  );
}
