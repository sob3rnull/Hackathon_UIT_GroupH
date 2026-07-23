import { NextResponse } from "next/server";
import { transcribeAudio, transcriptionProvider } from "@/lib/mediroute/transcribe";

/** ~1 minute of opus audio is well under this; guards the upstream API. */
const MAX_BYTES = 15 * 1024 * 1024;

/** Dictated audio clip → text, via the configured Whisper provider. */
export async function POST(request: Request) {
  if (!transcriptionProvider) {
    return NextResponse.json(
      { ok: false, error: "No transcription key configured" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body must be multipart form data" },
      { status: 400 },
    );
  }

  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "Attach the recording as the 'audio' field" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Recording too large — keep it under a minute" },
      { status: 400 },
    );
  }

  // Groq is constrained to the two languages the ambulance-page switch offers:
  // Burmese or English. Never auto-detect — an unset/unknown value defaults to
  // Burmese (the switch's own default) rather than letting Whisper pick a third
  // language and hand back a script no one on the crew can read.
  const languageRaw = form.get("language");
  const language: "my" | "en" = languageRaw === "en" ? "en" : "my";

  try {
    const text = await transcribeAudio(file, language);
    return NextResponse.json({
      ok: true,
      data: { text, provider: transcriptionProvider },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 502 },
    );
  }
}

/** Lets the mic button decide between server and browser transcription. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: { available: transcriptionProvider !== null, provider: transcriptionProvider },
  });
}
