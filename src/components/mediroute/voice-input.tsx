"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Languages, Mic, Square } from "lucide-react";
import { Spinner } from "@/components/ui/states";
import { useLocale, useT } from "@/lib/i18n/context";
import { translateApiError } from "@/lib/i18n/translate-error";
import { cn } from "@/lib/utils";
import type { ApiResult } from "@/lib/mediroute/types";

/**
 * Voice capture for the paramedic note. Two capture paths, best available
 * wins, and the UI always says which one is in use:
 *
 *  1. Server transcription (preferred when a key is configured): records the
 *     mic with MediaRecorder and posts the clip to /api/transcribe, which
 *     runs Whisper. Works in any browser and on networks where the built-in
 *     speech service is blocked; Burmese quality is much better.
 *  2. Browser SpeechRecognition (fallback, Chrome/Edge only): streams audio
 *     to the browser vendor's servers, live interim results, but dies with
 *     "network" on Brave, VPNs and filtered venue wifi.
 *
 * Typing always stays visible below — it is the path of last resort and the
 * only one that works fully offline.
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

const speechLanguages: { code: SpeechLanguage; labelKey: string }[] = [
  { code: "my-MM", labelKey: "voice.languageBurmese" },
  { code: "en-US", labelKey: "voice.languageEnglish" },
];

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

type CapturePath = "checking" | "server" | "browser" | "none";

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
  const t = useT();
  const { locale } = useLocale();
  const [path, setPath] = useState<CapturePath>("checking");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [language, setLanguage] = useState<SpeechLanguage>("my-MM");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef("");

  useEffect(() => {
    // Decide the capture path once: server transcription if the API has a
    // key, else browser speech if this browser implements it, else typing.
    let cancelled = false;
    void (async () => {
      let server = false;
      try {
        const response = await fetch("/api/transcribe");
        const result: ApiResult<{ available: boolean }> = await response.json();
        server = result.ok && result.data.available;
      } catch {
        // API unreachable — same as no key.
      }
      if (cancelled) return;
      setPath(server ? "server" : getRecognitionCtor() ? "browser" : "none");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  // Never leave the mic open if the component unmounts mid-capture.
  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopTracks();
    },
    [],
  );

  /* ── Path 1: record + server Whisper ─────────────────────────────────── */

  async function startRecording() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t("voice.micDenied"));
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(
      stream,
      pickRecorderMime() ? { mimeType: pickRecorderMime() } : undefined,
    );

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      stopTracks();
      setListening(false);
      onListeningChange?.(false);
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      if (blob.size > 0) void upload(blob);
    };

    recorderRef.current = recorder;
    recorder.start();
    setListening(true);
    onListeningChange?.(true);
  }

  async function upload(blob: Blob) {
    setTranscribing(true);
    try {
      const form = new FormData();
      const extension = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("audio", blob, `note.${extension}`);
      form.append("language", language === "my-MM" ? "my" : "en");

      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      const result: ApiResult<{ text: string }> = await response.json();
      if (!result.ok) throw new Error(result.error);
      if (!result.data.text) {
        setError(t("voice.nothingHeard"));
        return;
      }
      onTranscript(result.data.text);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? t("voice.transcriptionFailed", {
              message: translateApiError(cause.message, t, locale),
            })
          : t("voice.transcriptionFailedGeneric"),
      );
    } finally {
      setTranscribing(false);
    }
  }

  /* ── Path 2: browser SpeechRecognition ───────────────────────────────── */

  function startBrowserSpeech() {
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
          ? t("voice.micDenied")
          : event.error === "network"
            ? t("voice.speechUnreachable")
            : t("voice.voiceError", { error: event.error }),
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

  const start = () => {
    if (path === "server") void startRecording();
    else startBrowserSpeech();
  };

  if (path === "checking") return null;

  if (path === "none") {
    return <p className="text-xs text-muted">{t("voice.needsChromeEdge")}</p>;
  }

  const busy = disabled || transcribing;

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
              disabled={busy || listening}
              aria-pressed={language === option.code}
              className={cn(
                "h-full px-3 text-xs font-medium transition-colors",
                language === option.code
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-muted hover:text-foreground",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={busy}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
            listening
              ? "bg-danger text-white"
              : "border border-border bg-surface text-foreground hover:bg-surface-muted",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {transcribing ? (
            <>
              <Spinner />
              {t("voice.transcribing")}
            </>
          ) : listening ? (
            <>
              <Square className="size-3.5 fill-current" />
              {t("voice.stopDictating")}
              <span className="ml-1 inline-flex size-2 animate-pulse rounded-full bg-white" />
            </>
          ) : (
            <>
              <Mic className="size-4" />
              {t("voice.dictate")}
            </>
          )}
        </button>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {listening ? (
        <p className="text-xs text-muted">
          {path === "server" ? t("voice.listeningServer") : t("voice.listeningBrowser")}
        </p>
      ) : null}
      <p className="text-xs text-muted">
        {path === "server" ? t("voice.hintServer") : t("voice.hintBrowser")}
      </p>
    </div>
  );
}
