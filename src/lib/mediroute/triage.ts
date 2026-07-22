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

const SYSTEM = `You are a triage assistant for ambulance dispatch in Yangon, Myanmar.

Extract structured triage data from a paramedic's free-text note.
The note may be typed English, typed Burmese, or a speech-to-text transcript of
Burmese emergency speech. Understand common Burmese medical clauses and map them
to the same structured output.

This is DECISION SUPPORT for a trained dispatcher who reviews every result before
acting. You are never the final decision.

Rules:
- If the note is ambiguous or information is missing, choose the HIGHER severity.
- needsICU is true when the patient plausibly requires intensive care on arrival
  (unstable vitals, altered consciousness, major trauma, suspected MI or stroke).
- redFlags: the specific clinical findings in the note that drove your call.
  Quote or closely paraphrase the note. This is shown to the dispatcher as the
  justification, so it must be traceable to the input — never invent findings.
- If the input is Burmese, keep redFlags traceable to the Burmese wording and do
  not translate away clinically important details.
- confidence: 0..1. Be honest. A vague note deserves a low number.`;

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
      model: "claude-opus-4-8",
      max_tokens: 1024,
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
