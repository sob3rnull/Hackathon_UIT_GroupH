import "server-only";

/**
 * Server-side speech-to-text, so dictation survives venues where the
 * browser's built-in speech service is blocked (it streams to the browser
 * vendor and fails with "network" on Brave, VPNs and filtered wifi).
 *
 * Provider chain, same philosophy as triage: use what's configured, degrade
 * honestly. OpenAI Whisper if OPENAI_API_KEY is set, else Groq's hosted
 * whisper-large-v3 (free tier, strong Burmese) if GROQ_API_KEY is set, else
 * unavailable — and the mic button falls back to browser speech, then typing.
 */

const openaiKey = process.env.OPENAI_API_KEY ?? "";
const groqKey = process.env.GROQ_API_KEY ?? "";

export type TranscriptionProvider = "openai" | "groq";

export const transcriptionProvider: TranscriptionProvider | null = openaiKey
  ? "openai"
  : groqKey
    ? "groq"
    : null;

const endpoints: Record<TranscriptionProvider, { url: string; model: string; key: () => string }> = {
  openai: {
    url: "https://api.openai.com/v1/audio/transcriptions",
    model: "whisper-1",
    key: () => openaiKey,
  },
  groq: {
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    model: "whisper-large-v3",
    key: () => groqKey,
  },
};

/** The only two languages the ambulance-page voice switch — and Groq — support. */
export type TranscribeLanguage = "my" | "en";

export async function transcribeAudio(
  file: File,
  language: TranscribeLanguage,
): Promise<string> {
  if (!transcriptionProvider) {
    throw new Error("No transcription key configured");
  }
  const provider = endpoints[transcriptionProvider];

  const form = new FormData();
  form.append("file", file, file.name || "note.webm");
  form.append("model", provider.model);
  form.append("response_format", "json");
  // Always pin the language (Burmese or English). Whisper forces its output to
  // this language instead of auto-detecting, so Groq can't return a third one.
  form.append("language", language);

  const response = await fetch(provider.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key()}` },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Transcription failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await response.json()) as { text?: string };
  return (data.text ?? "").trim();
}
