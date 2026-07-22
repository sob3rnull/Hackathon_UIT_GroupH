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

This is DECISION SUPPORT for a trained dispatcher who reviews every result before
acting. You are never the final decision.

Rules:
- If the note is ambiguous or information is missing, choose the HIGHER severity.
- needsICU is true when the patient plausibly requires intensive care on arrival
  (unstable vitals, altered consciousness, major trauma, suspected MI or stroke).
- redFlags: the specific clinical findings in the note that drove your call.
  Quote or closely paraphrase the note. This is shown to the dispatcher as the
  justification, so it must be traceable to the input — never invent findings.
- confidence: 0..1. Be honest. A vague note deserves a low number.`;

function specialtyOf(condition: Condition) {
  return specialtyFor[condition] ?? "general";
}

/* ── Keyword fallback ──────────────────────────────────────────────────── */

const CONDITION_HINTS: [Condition, RegExp][] = [
  ["cardiac", /\b(chest pain|cardiac|heart|mi\b|myocardial|angina|palpitation|arrest)\b/i],
  ["stroke", /\b(stroke|facial droop|slurred|hemipleg|aphasi|fast test|cva\b|weakness on one side)\b/i],
  ["burn", /\b(burn|scald|fire|flame|thermal)\b/i],
  ["obstetric", /\b(pregnan|labou?r|contraction|obstetric|delivery|miscarriage|eclamps)\b/i],
  ["paediatric", /\b(child|infant|baby|toddler|paediatric|pediatric|\b[1-9] ?(year|yr|month)s? old)\b/i],
  ["trauma", /\b(trauma|fracture|rta\b|road traffic|accident|fall|stab|gunshot|laceration|collision|crush)\b/i],
];

const CRITICAL_HINTS =
  /\b(unconscious|unresponsive|arrest|not breathing|apnoe|gasping|severe|massive|profuse|shock|bp ?[0-8]?[0-9]\/|sats? ?[0-8][0-9]|gcs ?[3-9]\b)\b/i;
const STABLE_HINTS = /\b(mild|minor|stable|alert|walking|superficial|no distress)\b/i;
const ICU_HINTS =
  /\b(unconscious|unresponsive|arrest|intubat|ventilat|shock|severe|gcs|sats? ?[0-8][0-9]|major)\b/i;

function keywordTriage(note: string): Triage {
  const condition =
    CONDITION_HINTS.find(([, re]) => re.test(note))?.[0] ?? "general";

  let severity: Severity = "urgent";
  if (CRITICAL_HINTS.test(note)) severity = "critical";
  else if (STABLE_HINTS.test(note)) severity = "stable";

  const redFlags: string[] = [];
  const critical = note.match(CRITICAL_HINTS);
  if (critical) redFlags.push(`Matched critical indicator: "${critical[0]}"`);
  const conditionHit = CONDITION_HINTS.find(([, re]) => re.test(note));
  if (conditionHit) {
    redFlags.push(`Matched ${conditionHit[0]} keywords`);
  }
  if (redFlags.length === 0) redFlags.push("No specific indicators matched");

  return {
    condition,
    severity,
    requiredSpecialty: specialtyOf(condition),
    needsICU: ICU_HINTS.test(note),
    redFlags,
    confidence: conditionHit ? 0.45 : 0.2, // deliberately low — this is not AI
  };
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
