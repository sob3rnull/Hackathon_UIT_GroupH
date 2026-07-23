import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  conditions,
  severities,
  specialtyFor,
  triageSchema,
  type Condition,
  type Severity,
  type Triage,
} from "./types";
import { keywordTriage } from "./keyword-triage";

/**
 * Free-text paramedic note → structured triage.
 *
 * Two paths, same output shape, so nothing downstream can tell which ran:
 *   1. Claude with structured outputs — the real thing.
 *   2. A keyword matcher — used when ANTHROPIC_API_KEY is absent or the call
 *      fails. Not smart, but it keeps the demo alive on dead venue wifi.
 *
 * `source` is returned so the UI can be honest about which one produced the
 * result. Never present fallback output as an AI result.
 */

export type TriageSource = "claude" | "keyword";
export interface TriageResult {
  triage: Triage;
  source: TriageSource;
  /** Present when the AI path was attempted and failed. */
  note?: string;
}

export const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

// Kept terse on purpose: fewer input tokens per call. Every rule that changes
// the output still earns its place; prose that didn't was cut.
const SYSTEM = `Triage assistant for ambulance dispatch in Yangon, Myanmar. Extract structured triage from a paramedic's note (typed English, typed Burmese, or Burmese speech-to-text). Decision support only — a dispatcher reviews every result.
Rules:
- Ambiguous or missing info → choose the HIGHER severity.
- needsICU: true when intensive care is plausibly needed on arrival (unstable vitals, altered consciousness, major trauma, suspected MI or stroke).
- redFlags: the specific findings from the note that drove your call. Quote or closely paraphrase — never invent. If the note is Burmese, keep redFlags traceable to the Burmese wording.
- confidence 0..1, honest. A vague note deserves a low number.`;

function specialtyOf(condition: Condition) {
  return specialtyFor[condition] ?? "general";
}

/* ── Public API ────────────────────────────────────────────────────────── */

export async function runTriage(note: string): Promise<TriageResult> {
  if (!hasAnthropicKey) {
    return { triage: keywordTriage(note), source: "keyword" };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      // Haiku 4.5 — cheapest capable model; triage is a short structured extract.
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: note }],
      output_config: { format: zodOutputFormat(triageSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) throw new Error("Model returned no parsable output");

    // The model picks a specialty string freely; re-derive it from the
    // condition so it always matches what hospitals actually list.
    return {
      triage: { ...parsed, requiredSpecialty: specialtyOf(parsed.condition) },
      source: "claude",
    };
  } catch (error) {
    return {
      triage: keywordTriage(note),
      source: "keyword",
      note:
        error instanceof Error
          ? `AI triage unavailable (${error.message}) — used keyword fallback`
          : "AI triage unavailable — used keyword fallback",
    };
  }
}

/** Build a triage object from the manual dropdown, bypassing both paths. */
export function manualTriage(
  condition: Condition,
  severity: Severity,
  needsICU: boolean,
): Triage {
  return {
    condition,
    severity,
    requiredSpecialty: specialtyOf(condition),
    needsICU,
    redFlags: ["Entered manually by dispatcher"],
    confidence: 1,
  };
}

export { conditions, severities };
