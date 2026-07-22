"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Languages, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Voice capture for the paramedic note, using the browser's built-in
 * SpeechRecognition. No SDK, no API key, no cost.
 *
 * Two honest limitations, both surfaced in the UI rather than hidden:
 *  1. Chrome/Edge only. Firefox and most mobile browsers don't implement it,
 *     so the button hides itself and typing remains the primary path.
 *  2. It streams audio to the browser vendor's servers — so unlike the rest of
 *     MediRoute, this feature does NOT work offline. If venue wifi dies, voice
 *     dies with it. Typing is the fallback, and it always stays visible.
 *
 * Real deployment on an in-ambulance device would want an on-device model
 * (noisy cabin, no connectivity, and clinical audio shouldn't leave the
 * vehicle) — that's a hardware decision, not a browser one.
 */

/* Minimal typings — SpeechRecognition isn't in TS's DOM lib. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechLanguage = "my-MM" | "en-US";

const speechLanguages: { code: SpeechLanguage; label: string }[] = [
  { code: "my-MM", label: "Burmese" },
  { code: "en-US", label: "English" },
];

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceInput({
  onTranscript,
  onListeningChange,
  disabled,
}: {
  /** Called with the full transcript so far (interim + final). */
  onTranscript: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState<SpeechLanguage>("my-MM");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");

  useEffect(() => {
    // Browser capability check — can't run during render because the API is
    // window-only and this component is server-rendered first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    setError(null);
    finalRef.current = "";

    const recognition = new Ctor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalRef.current += text;
        else interim += text;
      }
      onTranscript((finalRef.current + interim).trim());
    };

    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone permission denied"
          : event.error === "network"
            ? "Speech service unreachable — type the note instead"
            : `Voice input error: ${event.error}`,
      );
      setListening(false);
      onListeningChange?.(false);
    };

    recognition.onend = () => {
      setListening(false);
      onListeningChange?.(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    onListeningChange?.(true);
  }

  // Never leave the mic open if the component unmounts mid-capture.
  useEffect(() => () => recognitionRef.current?.stop(), []);

  if (!supported) {
    return (
      <p className="text-xs text-muted">
        Voice input needs Chrome or Edge — type the note instead.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-10 items-center overflow-hidden rounded-lg border border-border bg-surface text-sm">
          <span className="grid h-full w-9 place-items-center border-r border-border text-muted">
            <Languages className="size-4" />
          </span>
          {speechLanguages.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => setLanguage(option.code)}
              disabled={disabled || listening}
              aria-pressed={language === option.code}
              className={cn(
                "h-full px-3 text-xs font-medium transition-colors",
                language === option.code
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-muted hover:text-foreground",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={disabled}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
            listening
              ? "bg-danger text-white"
              : "border border-border bg-surface text-foreground hover:bg-surface-muted",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {listening ? (
            <>
              <Square className="size-3.5 fill-current" />
              Stop dictating
              <span className="ml-1 inline-flex size-2 animate-pulse rounded-full bg-white" />
            </>
          ) : (
            <>
              <Mic className="size-4" />
              Dictate
            </>
          )}
        </button>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {listening ? (
        <p className="text-xs text-muted">Listening — speak the patient description.</p>
      ) : null}
    </div>
  );
}
